import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { v4 as uuidv4 } from 'uuid';
import {
  JobDefinition,
  ServiceDefinition,
  Job,
  Step,
  ExpressionContext,
  WorkflowRun,
} from '../types.js';
import { buildExpressionContext } from './context.js';
import { evaluateExpression, evaluateCondition } from './expression.js';
import { runStep, StepRunnerOpts } from './step-runner.js';

export interface JobRunnerOpts {
  workspacePath: string;
  run: WorkflowRun;
  jobId: string;
  jobDef: JobDefinition;
  workflowEnv: Record<string, string>;
  needs: Record<string, { outputs: Record<string, string>; result: string }>;
  completedJobs: Record<string, { outputs: Record<string, string> }>;
  emitter: EventEmitter;
  abortController: AbortController;
  secrets?: Record<string, string>;
  matrix?: Record<string, string>;
}

/**
 * Execute a single job (all its steps sequentially, with optional services).
 */
export async function runJob(opts: JobRunnerOpts): Promise<Job> {
  const { jobId, jobDef, run, emitter, abortController } = opts;

  const job: Job = {
    id: jobId,
    name: jobDef.name || jobId,
    status: 'queued',
    conclusion: undefined,
    steps: [],
    outputs: {},
  };

  // Evaluate job-level if: condition
  const ctx = buildExpressionContext({
    workspacePath: opts.workspacePath,
    event: run.trigger.event,
    ref: run.trigger.ref,
    sha: run.trigger.sha,
    workflowEnv: opts.workflowEnv,
    jobEnv: {},
    stepEnv: {},
    inputs: run.inputs || {},
    steps: {},
    needs: opts.needs,
    jobs: opts.completedJobs,
    secrets: opts.secrets,
    matrix: opts.matrix,
  });

  // Update github context with run-specific info
  (ctx.github as Record<string, unknown>).run_id = run.id;
  (ctx.github as Record<string, unknown>).job = jobId;

  if (!evaluateCondition(jobDef.if, ctx)) {
    job.status = 'completed';
    job.conclusion = 'skipped';
    emitter.emit('job.completed', { runId: run.id, jobId, job });
    return job;
  }

  // Start services if defined
  let serviceCleanup: (() => Promise<void>) | undefined;
  if (jobDef.services && Object.keys(jobDef.services).length > 0) {
    try {
      serviceCleanup = await startServices(jobDef.services, opts.workspacePath, run.id, jobId);
    } catch (err) {
      job.status = 'completed';
      job.conclusion = 'failure';
      job.steps.push({
        name: 'Start services',
        status: 'completed',
        conclusion: 'failure',
        log: `Failed to start services: ${err instanceof Error ? err.message : String(err)}\n`,
        outputs: {},
        number: 0,
      });
      emitter.emit('job.completed', { runId: run.id, jobId, job });
      return job;
    }
  }

  job.status = 'in_progress';
  job.startedAt = new Date().toISOString();
  emitter.emit('job.started', { runId: run.id, jobId, job });

  // Job timeout
  const timeoutMs = jobDef['timeout-minutes']
    ? jobDef['timeout-minutes'] * 60 * 1000
    : 6 * 60 * 60 * 1000; // default 6 hours

  const jobTimeout = setTimeout(() => {
    abortController.abort();
  }, timeoutMs);

  // Resolve job-level env
  const jobEnv = resolveEnv(jobDef.env || {}, ctx);

  // Track step outputs and env accumulations
  const stepContexts: Record<string, { outputs: Record<string, string>; outcome: string; conclusion: string }> = {};
  let accumulatedEnv: Record<string, string> = {};
  let failed = false;

  try {
    for (let i = 0; i < jobDef.steps.length; i++) {
      if (abortController.signal.aborted) {
        break;
      }

      const stepDef = jobDef.steps[i];

      // Build the expression context for this step
      const stepCtx = buildExpressionContext({
        workspacePath: opts.workspacePath,
        event: run.trigger.event,
        ref: run.trigger.ref,
        sha: run.trigger.sha,
        workflowEnv: opts.workflowEnv,
        jobEnv: { ...jobEnv, ...accumulatedEnv },
        stepEnv: {},
        inputs: run.inputs || {},
        steps: stepContexts,
        needs: opts.needs,
        jobs: opts.completedJobs,
        secrets: opts.secrets,
        matrix: opts.matrix,
      });

      (stepCtx.github as Record<string, unknown>).run_id = run.id;
      (stepCtx.github as Record<string, unknown>).job = jobId;

      // If a previous step failed and this step doesn't have an if: always() condition,
      // skip it (unless it has an explicit if: condition)
      if (failed && !stepDef.if) {
        const skippedStep: Step = {
          name: stepDef.name || stepDef.run?.slice(0, 60) || stepDef.uses || `Step ${i + 1}`,
          status: 'completed',
          conclusion: 'skipped',
          log: 'Skipped due to previous step failure\n',
          outputs: {},
          number: i + 1,
        };
        job.steps.push(skippedStep);
        continue;
      }

      const stepRunnerOpts: StepRunnerOpts = {
        workspacePath: opts.workspacePath,
        runId: run.id,
        jobId,
        event: run.trigger.event,
        ref: run.trigger.ref,
        sha: run.trigger.sha,
        workflow: run.workflow,
        workflowEnv: opts.workflowEnv,
        jobEnv: { ...jobEnv, ...accumulatedEnv },
        expressionCtx: stepCtx,
        emitter,
        signal: abortController.signal,
        defaults: jobDef.defaults?.run,
        secretValues: opts.secrets ? Object.values(opts.secrets).filter(v => v.length > 0) : [],
      };

      try {
        const result = await runStep(stepDef, i + 1, stepRunnerOpts);
        job.steps.push(result.step);

        // Track outputs for expression context
        if (stepDef.id) {
          stepContexts[stepDef.id] = {
            outputs: result.outputs,
            outcome: result.step.conclusion || 'success',
            conclusion: result.step.conclusion || 'success',
          };
        }

        // Accumulate env updates
        Object.assign(accumulatedEnv, result.envUpdates);

        if (result.step.conclusion === 'failure') {
          failed = true;
        }
      } catch (err) {
        failed = true;
        // Step already added in runStep via the throw path if continue-on-error is false
        // but we need to make sure it's in the job steps
        const existingStep = job.steps.find(s => s.number === i + 1);
        if (!existingStep) {
          job.steps.push({
            name: stepDef.name || stepDef.run?.slice(0, 60) || stepDef.uses || `Step ${i + 1}`,
            status: 'completed',
            conclusion: 'failure',
            log: `Error: ${err instanceof Error ? err.message : String(err)}\n`,
            outputs: {},
            number: i + 1,
          });
        }

        if (stepDef.id) {
          stepContexts[stepDef.id] = {
            outputs: {},
            outcome: 'failure',
            conclusion: 'failure',
          };
        }
      }
    }
  } finally {
    clearTimeout(jobTimeout);

    // Stop services
    if (serviceCleanup) {
      try { await serviceCleanup(); } catch { /* ignore */ }
    }
  }

  // Resolve job outputs
  if (jobDef.outputs) {
    const outputCtx = buildExpressionContext({
      workspacePath: opts.workspacePath,
      event: run.trigger.event,
      ref: run.trigger.ref,
      sha: run.trigger.sha,
      workflowEnv: opts.workflowEnv,
      jobEnv,
      stepEnv: {},
      inputs: run.inputs || {},
      steps: stepContexts,
      needs: opts.needs,
      jobs: opts.completedJobs,
      secrets: opts.secrets,
      matrix: opts.matrix,
    });

    for (const [name, expr] of Object.entries(jobDef.outputs)) {
      job.outputs[name] = evaluateExpression(expr, outputCtx);
    }
  }

  job.status = 'completed';
  job.conclusion = failed ? 'failure' : (abortController.signal.aborted ? 'cancelled' : 'success');
  job.completedAt = new Date().toISOString();

  emitter.emit('job.completed', { runId: run.id, jobId, job });
  return job;
}

// ── Services via docker-compose ──

async function startServices(
  services: Record<string, ServiceDefinition>,
  workspacePath: string,
  runId: string,
  jobId: string,
): Promise<() => Promise<void>> {
  const composeFile = generateDockerCompose(services);
  const composeDir = fs.mkdtempSync(path.join(os.tmpdir(), `runner-services-${runId}-`));
  const composePath = path.join(composeDir, 'docker-compose.yml');
  fs.writeFileSync(composePath, composeFile);

  const projectName = `runner-${runId}-${jobId}`.replace(/[^a-z0-9-]/g, '-').toLowerCase();

  // Start services
  await new Promise<void>((resolve, reject) => {
    const proc = spawn('docker', ['compose', '-f', composePath, '-p', projectName, 'up', '-d'], {
      cwd: workspacePath,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('error', (err) => reject(new Error(`docker compose failed: ${err.message}`)));
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(`docker compose up failed (exit ${code}): ${stderr}`));
      else resolve();
    });
  });

  // Return cleanup function
  return async () => {
    await new Promise<void>((resolve) => {
      const proc = spawn('docker', ['compose', '-f', composePath, '-p', projectName, 'down', '-v', '--remove-orphans'], {
        stdio: 'ignore',
      });
      proc.on('close', () => {
        try { fs.rmSync(composeDir, { recursive: true }); } catch { /* ignore */ }
        resolve();
      });
      proc.on('error', () => resolve());
    });
  };
}

function generateDockerCompose(services: Record<string, ServiceDefinition>): string {
  const compose: Record<string, unknown> = {
    version: '3.8',
    services: {} as Record<string, unknown>,
  };

  for (const [name, svc] of Object.entries(services)) {
    const svcDef: Record<string, unknown> = {
      image: svc.image,
    };

    if (svc.ports && svc.ports.length > 0) {
      svcDef.ports = svc.ports;
    }

    if (svc.env && Object.keys(svc.env).length > 0) {
      svcDef.environment = svc.env;
    }

    if (svc.volumes && svc.volumes.length > 0) {
      svcDef.volumes = svc.volumes;
    }

    if (svc.options) {
      // Parse docker options into compose equivalents where possible
      svcDef.privileged = svc.options.includes('--privileged');
    }

    (compose.services as Record<string, unknown>)[name] = svcDef;
  }

  // Manual YAML generation (simple, no dependency needed)
  return serializeYaml(compose);
}

function serializeYaml(obj: unknown, indent: number = 0): string {
  const prefix = '  '.repeat(indent);
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj === 'string') return obj.includes(':') || obj.includes('#') ? `"${obj}"` : obj;
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
  if (Array.isArray(obj)) {
    return obj.map(item => `${prefix}- ${serializeYaml(item, indent + 1).trimStart()}`).join('\n');
  }
  if (typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>);
    return entries.map(([k, v]) => {
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        return `${prefix}${k}:\n${serializeYaml(v, indent + 1)}`;
      }
      if (Array.isArray(v)) {
        return `${prefix}${k}:\n${serializeYaml(v, indent + 1)}`;
      }
      return `${prefix}${k}: ${serializeYaml(v, indent)}`;
    }).join('\n');
  }
  return String(obj);
}

function resolveEnv(env: Record<string, string>, ctx: ExpressionContext): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    resolved[k] = evaluateExpression(String(v), ctx);
  }
  return resolved;
}
