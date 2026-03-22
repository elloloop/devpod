import { EventEmitter } from 'node:events';
import { execSync } from 'node:child_process';
import { v4 as uuidv4 } from 'uuid';
import {
  WorkflowFile,
  WorkflowRun,
  Job,
  JobDefinition,
  RunStatus,
} from '../types.js';
import { parseWorkflowFile, findWorkflow } from './parser.js';
import { runJob, JobRunnerOpts } from './job-runner.js';
import { resolveReusableWorkflow } from './reusable.js';
import { ArtifactStore } from '../artifacts/store.js';
import { SecretsStore } from '../secrets/store.js';
import { expandMatrix } from './matrix.js';
import { createSandbox, Sandbox } from './sandbox.js';
import { JobScheduler, prepareSchedulableJobs, SchedulableJob, NeedsContext, JobsContext } from './scheduler.js';

export interface RunSandboxOptions {
  strategy?: 'worktree' | 'copy' | 'none'; // 'none' to run in-place (current behavior)
  ref?: string;
}

export class WorkflowExecutor {
  private runs: Map<string, WorkflowRun> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();
  readonly emitter: EventEmitter = new EventEmitter();
  readonly artifacts: ArtifactStore;
  readonly secretsStore: SecretsStore | null;
  private workspacePath: string;

  constructor(workspacePath: string, artifactStore?: ArtifactStore, secretsStore?: SecretsStore) {
    this.workspacePath = workspacePath;
    this.artifacts = artifactStore || new ArtifactStore();
    this.secretsStore = secretsStore || null;
    this.emitter.setMaxListeners(100);
  }

  /**
   * Trigger a new workflow run.
   */
  async triggerRun(workflowName: string, inputs?: Record<string, string>, sandboxOpts?: RunSandboxOptions): Promise<WorkflowRun> {
    const found = findWorkflow(this.workspacePath, workflowName);
    if (!found) {
      throw new Error(`Workflow '${workflowName}' not found`);
    }

    const { workflow, filePath } = found;

    // Get git info for trigger context
    let ref = 'refs/heads/main';
    let sha = '0000000000000000000000000000000000000000';
    try {
      ref = `refs/heads/${execSync('git rev-parse --abbrev-ref HEAD', { cwd: this.workspacePath, encoding: 'utf-8' }).trim()}`;
      sha = execSync('git rev-parse HEAD', { cwd: this.workspacePath, encoding: 'utf-8' }).trim();
    } catch {
      // Not a git repo, use defaults
    }

    const run: WorkflowRun = {
      id: uuidv4(),
      workflow: workflowName,
      status: 'queued',
      jobs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      trigger: {
        event: 'workflow_dispatch',
        ref,
        sha,
      },
      inputs: inputs || {},
      env: workflow.env || {},
    };

    this.runs.set(run.id, run);

    // Execute asynchronously
    const abortController = new AbortController();
    this.abortControllers.set(run.id, abortController);

    this.executeRun(run, workflow, sandboxOpts).catch((err) => {
      console.error(`Run ${run.id} failed unexpectedly:`, err);
      run.status = 'failed';
      run.conclusion = 'failure';
      run.updatedAt = new Date().toISOString();
      this.emitter.emit('run.completed', { runId: run.id, run });
    });

    return run;
  }

  /**
   * Get a run by ID.
   */
  getRun(id: string): WorkflowRun | undefined {
    return this.runs.get(id);
  }

  /**
   * List all runs, optionally filtered by status.
   */
  listRuns(status?: RunStatus): WorkflowRun[] {
    let runs = Array.from(this.runs.values());
    if (status) {
      runs = runs.filter(r => r.status === status);
    }
    return runs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Cancel a running workflow.
   */
  cancelRun(id: string): boolean {
    const run = this.runs.get(id);
    if (!run) return false;
    if (run.status !== 'queued' && run.status !== 'in_progress') return false;

    const controller = this.abortControllers.get(id);
    if (controller) {
      controller.abort();
    }

    run.status = 'cancelled';
    run.conclusion = 'cancelled';
    run.updatedAt = new Date().toISOString();

    this.emitter.emit('run.completed', { runId: run.id, run });
    return true;
  }

  /**
   * Get logs for a run (all steps concatenated).
   */
  getRunLogs(id: string): string {
    const run = this.runs.get(id);
    if (!run) return '';

    const lines: string[] = [];
    for (const job of run.jobs) {
      lines.push(`=== Job: ${job.name} (${job.id}) ===`);
      for (const step of job.steps) {
        lines.push(`--- Step ${step.number}: ${step.name} [${step.conclusion || step.status}] ---`);
        lines.push(step.log);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  // ── Internal execution ──

  private async executeRun(run: WorkflowRun, workflow: WorkflowFile, sandboxOpts?: RunSandboxOptions): Promise<void> {
    run.status = 'in_progress';
    run.updatedAt = new Date().toISOString();
    this.emitter.emit('run.started', { runId: run.id, run });

    const abortController = this.abortControllers.get(run.id)!;

    // Create sandbox for isolated execution
    let sandbox: Sandbox | null = null;
    let effectiveWorkspace = this.workspacePath;
    const sandboxStrategy = sandboxOpts?.strategy || 'auto';

    if (sandboxStrategy !== 'none') {
      try {
        sandbox = await createSandbox({
          workspacePath: this.workspacePath,
          runId: run.id,
          strategy: sandboxStrategy === 'auto' ? 'auto' : sandboxStrategy as 'worktree' | 'copy',
          ref: sandboxOpts?.ref,
        });
        effectiveWorkspace = sandbox.path;
        run.sandbox = { path: sandbox.path, strategy: sandbox.strategy };
        console.log(`Sandbox created: ${sandbox.strategy} at ${sandbox.path}`);
      } catch (err) {
        console.warn(`Sandbox creation failed, running in-place: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    try {
    // Build the job dependency graph and expand matrix strategies
    const jobDefs = workflow.jobs;
    const jobOrder = topologicalSort(jobDefs);
    const { jobs: schedulableJobs, originalToExpanded } = prepareSchedulableJobs(jobDefs, jobOrder, expandMatrix);

    // Run the scheduling loop
    const scheduler = new JobScheduler({
      jobs: schedulableJobs,
      originalToExpanded,
      jobDefs,
      abortController,
      onLaunchJob: (entry: SchedulableJob, needsCtx: NeedsContext, jobsCtx: JobsContext) => {
        return this.launchJob(entry, needsCtx, jobsCtx, run, workflow, abortController, effectiveWorkspace);
      },
      onJobSkipped: (jobId: string, job: Job) => {
        // Skipped/cancelled jobs created by the scheduler need to be added
        // to the run and have their completion event emitted here (they never
        // went through runJob which would otherwise emit the event).
        run.jobs.push(job);
        this.emitter.emit('job.completed', { runId: run.id, jobId, job });
      },
      onLaunchedJobCompleted: (jobId: string, job: Job) => {
        // Launched jobs already emitted job.completed from runJob /
        // executeReusableWorkflowCall. We only need to track them in the
        // run's jobs array and update the timestamp.
        const existingIdx = run.jobs.findIndex(j => j.id === jobId);
        if (existingIdx >= 0) {
          run.jobs[existingIdx] = job;
        } else {
          run.jobs.push(job);
        }
        run.updatedAt = new Date().toISOString();
      },
    });

    const { anyFailed } = await scheduler.run();

    // Set final run status
    if (abortController.signal.aborted) {
      run.status = 'cancelled';
      run.conclusion = 'cancelled';
    } else if (anyFailed) {
      run.status = 'failed';
      run.conclusion = 'failure';
    } else {
      run.status = 'completed';
      run.conclusion = 'success';
    }

    run.updatedAt = new Date().toISOString();
    this.emitter.emit('run.completed', { runId: run.id, run });
    this.abortControllers.delete(run.id);

    } finally {
      // Cleanup sandbox
      if (sandbox) {
        try {
          await sandbox.cleanup();
          console.log(`Sandbox cleaned up: ${sandbox.path}`);
        } catch (err) {
          console.warn(`Sandbox cleanup failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  }

  /**
   * Launch a single job, handling both regular jobs and reusable workflow calls.
   * Used as the onLaunchJob callback for the JobScheduler.
   */
  private launchJob(
    entry: SchedulableJob,
    needsCtx: NeedsContext,
    jobsCtx: JobsContext,
    run: WorkflowRun,
    workflow: WorkflowFile,
    abortController: AbortController,
    effectiveWorkspace: string,
  ): Promise<Job> {
    const currentSecrets = this.secretsStore ? this.secretsStore.getAllSecrets() : {};

    // Check if this is a reusable workflow call
    if (entry.def.uses) {
      return this.executeReusableWorkflowCall(
        entry.id, entry.def, run, workflow, needsCtx, jobsCtx,
        currentSecrets, abortController, effectiveWorkspace,
      );
    }

    const opts: JobRunnerOpts = {
      workspacePath: effectiveWorkspace,
      run,
      jobId: entry.id,
      jobDef: entry.def,
      workflowEnv: workflow.env || {},
      needs: needsCtx,
      completedJobs: jobsCtx,
      emitter: this.emitter,
      abortController,
      secrets: currentSecrets,
      matrix: entry.matrix,
    };

    return runJob(opts);
  }

  /**
   * Execute a reusable workflow call (job with `uses:` pointing to another workflow).
   *
   * Resolves the called workflow, merges inputs and secrets, executes the called
   * workflow's jobs sequentially, and returns a synthetic Job that aggregates the results.
   * The called workflow's individual jobs also appear in the run's jobs array.
   */
  private async executeReusableWorkflowCall(
    callerJobId: string,
    callerJobDef: JobDefinition,
    run: WorkflowRun,
    callerWorkflow: WorkflowFile,
    needsCtx: Record<string, { outputs: Record<string, string>; result: string }>,
    jobsCtx: Record<string, { outputs: Record<string, string> }>,
    currentSecrets: Record<string, string>,
    abortController: AbortController,
    workspacePath?: string,
  ): Promise<Job> {
    const callerJobName = callerJobDef.name || callerJobId;
    const effectiveWorkspace = workspacePath || this.workspacePath;

    try {
      // Resolve the reusable workflow
      const resolved = await resolveReusableWorkflow(
        callerJobDef.uses!,
        callerJobDef.with,
        callerJobDef.secrets,
        currentSecrets,
        effectiveWorkspace,
      );

      console.log(
        `Reusable workflow call '${callerJobId}' resolved ${Object.keys(resolved.jobs).length} job(s) ` +
        `from '${callerJobDef.uses}'`
      );

      // Execute the called workflow's jobs respecting their internal dependency order
      const calledJobDefs = resolved.jobs;
      const calledJobOrder = topologicalSort(calledJobDefs);
      const calledCompletedJobs: Map<string, Job> = new Map();
      let anyCalledFailed = false;
      const calledJobOutputs: Record<string, Record<string, string>> = {};

      // Create a modified run inputs that includes the resolved inputs for the called workflow
      const calledInputs = resolved.resolvedInputs;

      for (const calledJobId of calledJobOrder) {
        if (abortController.signal.aborted) break;

        const calledJobDef = calledJobDefs[calledJobId];
        const calledNeeds = normalizeNeeds(calledJobDef.needs);

        // Check if internal dependencies are met
        const anyDepFailed = calledNeeds.some(n => calledCompletedJobs.get(n)?.conclusion === 'failure');
        if (anyDepFailed && !calledJobDef.if) {
          const skippedJob: Job = {
            id: `${callerJobId}/${calledJobId}`,
            name: `${callerJobName} / ${calledJobDef.name || calledJobId}`,
            status: 'completed',
            conclusion: 'skipped',
            steps: [],
            outputs: {},
          };
          calledCompletedJobs.set(calledJobId, skippedJob);
          run.jobs.push(skippedJob);
          this.emitter.emit('job.completed', { runId: run.id, jobId: skippedJob.id, job: skippedJob });
          continue;
        }

        // Build needs context from the called workflow's internal dependencies
        const calledNeedsCtx: Record<string, { outputs: Record<string, string>; result: string }> = {};
        for (const n of calledNeeds) {
          const dep = calledCompletedJobs.get(n);
          if (dep) {
            calledNeedsCtx[n] = {
              outputs: dep.outputs,
              result: dep.conclusion || 'success',
            };
          }
        }

        // Build jobs context combining caller's completed jobs and called workflow's completed jobs
        const calledJobsCtx: Record<string, { outputs: Record<string, string> }> = { ...jobsCtx };
        for (const [id, job] of calledCompletedJobs) {
          calledJobsCtx[id] = { outputs: job.outputs };
        }

        // Create a modified run that carries the called workflow's inputs
        // so the expression evaluator can resolve ${{ inputs.xxx }}
        const calledRun: WorkflowRun = {
          ...run,
          inputs: calledInputs,
        };

        const compositeJobId = `${callerJobId}/${calledJobId}`;

        const opts: JobRunnerOpts = {
          workspacePath: effectiveWorkspace,
          run: calledRun,
          jobId: compositeJobId,
          jobDef: {
            ...calledJobDef,
            name: `${callerJobName} / ${calledJobDef.name || calledJobId}`,
          },
          workflowEnv: { ...(callerWorkflow.env || {}), ...(resolved.workflow.env || {}) },
          needs: calledNeedsCtx,
          completedJobs: calledJobsCtx,
          emitter: this.emitter,
          abortController,
          secrets: currentSecrets,
        };

        const jobResult = await runJob(opts);
        calledCompletedJobs.set(calledJobId, jobResult);
        calledJobOutputs[calledJobId] = jobResult.outputs;

        // Add individual called job to the run's jobs
        const existingIdx = run.jobs.findIndex(j => j.id === compositeJobId);
        if (existingIdx >= 0) {
          run.jobs[existingIdx] = jobResult;
        } else {
          run.jobs.push(jobResult);
        }

        if (jobResult.conclusion === 'failure') {
          anyCalledFailed = true;
        }

        run.updatedAt = new Date().toISOString();
      }

      // Build the aggregate output for the caller job from the called workflow's
      // workflow_call outputs definition. Each output's `value` is an expression
      // like ${{ jobs.test.outputs.result }} that we resolve here.
      const aggregateOutputs: Record<string, string> = {};
      if (resolved.callTrigger.outputs) {
        for (const [outputName, outputDef] of Object.entries(resolved.callTrigger.outputs)) {
          // Simple resolution: replace jobs.<id>.outputs.<name> patterns
          let value = outputDef.value;
          const jobOutputPattern = /\$\{\{\s*jobs\.([^.]+)\.outputs\.([^}\s]+)\s*\}\}/g;
          value = value.replace(jobOutputPattern, (_match: string, jobId: string, outputKey: string) => {
            return calledJobOutputs[jobId]?.[outputKey] ?? '';
          });
          aggregateOutputs[outputName] = value;
        }
      }

      // Return a synthetic job representing the entire reusable workflow call
      const callerJob: Job = {
        id: callerJobId,
        name: callerJobName,
        status: 'completed',
        conclusion: anyCalledFailed
          ? 'failure'
          : (abortController.signal.aborted ? 'cancelled' : 'success'),
        steps: [{
          name: `Call ${callerJobDef.uses}`,
          status: 'completed',
          conclusion: anyCalledFailed ? 'failure' : 'success',
          log: `Executed reusable workflow '${callerJobDef.uses}' with ${calledJobOrder.length} job(s)\n`,
          outputs: {},
          number: 1,
        }],
        outputs: aggregateOutputs,
        completedAt: new Date().toISOString(),
      };

      this.emitter.emit('job.completed', { runId: run.id, jobId: callerJobId, job: callerJob });
      return callerJob;
    } catch (err) {
      // Failed to resolve or execute the reusable workflow
      const failedJob: Job = {
        id: callerJobId,
        name: callerJobName,
        status: 'completed',
        conclusion: 'failure',
        steps: [{
          name: `Call ${callerJobDef.uses}`,
          status: 'completed',
          conclusion: 'failure',
          log: `Failed to execute reusable workflow '${callerJobDef.uses}': ${err instanceof Error ? err.message : String(err)}\n`,
          outputs: {},
          number: 1,
        }],
        outputs: {},
        completedAt: new Date().toISOString(),
      };

      this.emitter.emit('job.completed', { runId: run.id, jobId: callerJobId, job: failedJob });
      return failedJob;
    }
  }
}

// ── Dependency resolution ──

function normalizeNeeds(needs: string | string[] | undefined): string[] {
  if (!needs) return [];
  if (typeof needs === 'string') return [needs];
  return needs;
}

/**
 * Topological sort of jobs based on `needs:` dependencies.
 * Returns job IDs in an order where dependencies come first.
 */
function topologicalSort(jobs: Record<string, { needs?: string | string[] }>): string[] {
  const jobIds = Object.keys(jobs);
  const visited = new Set<string>();
  const result: string[] = [];

  function visit(id: string, stack: Set<string>) {
    if (visited.has(id)) return;
    if (stack.has(id)) {
      throw new Error(`Circular dependency detected involving job '${id}'`);
    }

    stack.add(id);
    const needs = normalizeNeeds(jobs[id]?.needs);
    for (const dep of needs) {
      if (dep in jobs) {
        visit(dep, stack);
      }
    }
    stack.delete(id);
    visited.add(id);
    result.push(id);
  }

  for (const id of jobIds) {
    visit(id, new Set());
  }

  return result;
}
