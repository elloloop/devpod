import { spawn, ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { EventEmitter } from 'node:events';
import { StepDefinition, Step, ExpressionContext } from '../types.js';
import { evaluateExpression, evaluateCondition } from './expression.js';
import { buildGitHubEnv } from './context.js';
import { loadAction, resolveActionPath } from '../actions/loader.js';
import { resolveActionInputs, getCompositeSteps, resolveCompositeOutputs } from '../actions/composite.js';
import { runNodeAction, runNodeActionPost } from '../actions/node-runner.js';
import { runDockerAction } from '../actions/docker-runner.js';

export interface StepRunnerOpts {
  workspacePath: string;
  runId: string;
  jobId: string;
  event: string;
  ref: string;
  sha: string;
  workflow: string;
  workflowEnv: Record<string, string>;
  jobEnv: Record<string, string>;
  expressionCtx: ExpressionContext;
  emitter: EventEmitter;
  signal?: AbortSignal;
  defaults?: {
    'working-directory'?: string;
    shell?: string;
  };
  secretValues?: string[];
}

interface StepResult {
  step: Step;
  outputs: Record<string, string>;
  envUpdates: Record<string, string>;
  pathAdditions: string[];
}

/**
 * Execute a single step definition and return the result.
 */
export async function runStep(
  stepDef: StepDefinition,
  stepNumber: number,
  opts: StepRunnerOpts,
): Promise<StepResult> {
  const stepName = evaluateExpression(stepDef.name || stepDef.run?.slice(0, 60) || stepDef.uses || `Step ${stepNumber}`, opts.expressionCtx);

  const step: Step = {
    name: stepName,
    status: 'queued',
    conclusion: undefined,
    log: '',
    outputs: {},
    number: stepNumber,
  };

  // Check if: condition
  const shouldRun = evaluateCondition(stepDef.if, opts.expressionCtx);
  if (!shouldRun) {
    step.status = 'completed';
    step.conclusion = 'skipped';
    step.log = `Skipped: condition evaluated to false\n`;
    opts.emitter.emit('step.completed', { runId: opts.runId, jobId: opts.jobId, stepNumber, step });
    return { step, outputs: {}, envUpdates: {}, pathAdditions: [] };
  }

  // Mark step as in_progress
  step.status = 'in_progress';
  opts.emitter.emit('step.started', { runId: opts.runId, jobId: opts.jobId, stepNumber, step });

  try {
    let result: StepResult;

    if (stepDef.run) {
      result = await runShellStep(stepDef, step, opts);
    } else if (stepDef.uses) {
      result = await runUsesStep(stepDef, step, stepNumber, opts);
    } else {
      step.log += 'Warning: step has neither run nor uses\n';
      result = { step, outputs: {}, envUpdates: {}, pathAdditions: [] };
    }

    if (step.conclusion !== 'failure') {
      step.status = 'completed';
      step.conclusion = 'success';
    }

    opts.emitter.emit('step.completed', { runId: opts.runId, jobId: opts.jobId, stepNumber, step });
    return result;
  } catch (err) {
    step.status = 'completed';
    step.conclusion = 'failure';
    step.log += `\nError: ${err instanceof Error ? err.message : String(err)}\n`;
    opts.emitter.emit('step.completed', { runId: opts.runId, jobId: opts.jobId, stepNumber, step });

    if (stepDef['continue-on-error']) {
      return { step, outputs: {}, envUpdates: {}, pathAdditions: [] };
    }
    throw err;
  }
}

// ── Step environment setup / teardown helpers ──

interface StepEnvironment {
  env: Record<string, string>;
  cwd: string;
  tempDir: string;
  outputFile: string;
  envFile: string;
  summaryFile: string;
  pathFile: string;
  timeoutMs: number;
  secretValues: string[];
  onOutput: (line: string) => void;
}

/**
 * Create a temporary directory and build the merged environment that every
 * step type needs (workflow env + job env + step env + GITHUB_* vars).
 *
 * When `includeProcessEnv` is true the host process.env is spread first
 * (shell steps need this; node/docker action runners add it themselves).
 */
function prepareStepEnvironment(
  stepDef: StepDefinition,
  step: Step,
  opts: StepRunnerOpts,
  { tempPrefix = 'runner-step-', includeProcessEnv = false }: { tempPrefix?: string; includeProcessEnv?: boolean } = {},
): StepEnvironment {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), tempPrefix));
  const outputFile = path.join(tempDir, 'output');
  const envFile = path.join(tempDir, 'env');
  const summaryFile = path.join(tempDir, 'summary');
  const pathFile = path.join(tempDir, 'path');

  fs.writeFileSync(outputFile, '');
  fs.writeFileSync(envFile, '');
  fs.writeFileSync(summaryFile, '');
  fs.writeFileSync(pathFile, '');

  const stepEnv = stepDef.env ? resolveEnv(stepDef.env, opts.expressionCtx) : {};
  const githubEnv = buildGitHubEnv({
    workspacePath: opts.workspacePath,
    runId: opts.runId,
    event: opts.event,
    ref: opts.ref,
    sha: opts.sha,
    workflow: opts.workflow,
    job: opts.jobId,
    githubOutputFile: outputFile,
    githubEnvFile: envFile,
    githubStepSummaryFile: summaryFile,
    githubPathFile: pathFile,
  });

  const env: Record<string, string> = {
    ...(includeProcessEnv ? process.env as Record<string, string> : undefined),
    ...opts.workflowEnv,
    ...opts.jobEnv,
    ...stepEnv,
    ...githubEnv,
  };

  // Determine working directory (step-level overrides job defaults)
  let cwd = opts.workspacePath;
  const workDir = stepDef['working-directory'] || opts.defaults?.['working-directory'];
  if (workDir) {
    const resolvedDir = evaluateExpression(workDir, opts.expressionCtx);
    cwd = path.isAbsolute(resolvedDir) ? resolvedDir : path.resolve(opts.workspacePath, resolvedDir);
  }

  const timeoutMs = stepDef['timeout-minutes']
    ? stepDef['timeout-minutes'] * 60 * 1000
    : 60 * 60 * 1000; // default 1 hour

  const secretValues = opts.secretValues || [];

  const onOutput = (line: string) => {
    const masked = maskSecrets(line, secretValues);
    step.log += masked;
    opts.emitter.emit('step.log', {
      runId: opts.runId,
      jobId: opts.jobId,
      stepNumber: step.number,
      line: masked,
    });
  };

  return { env, cwd, tempDir, outputFile, envFile, summaryFile, pathFile, timeoutMs, secretValues, onOutput };
}

interface StepOutputs {
  outputs: Record<string, string>;
  envUpdates: Record<string, string>;
  pathAdditions: string[];
}

/**
 * Parse GITHUB_OUTPUT, GITHUB_ENV, and GITHUB_PATH files, then clean up the
 * temporary directory that was created by `prepareStepEnvironment`.
 */
function collectStepOutputs(stepEnv: StepEnvironment): StepOutputs {
  const outputs = parseKeyValueFile(stepEnv.outputFile);
  const envUpdates = parseKeyValueFile(stepEnv.envFile);

  const pathContent = fs.readFileSync(stepEnv.pathFile, 'utf-8').trim();
  const pathAdditions = pathContent ? pathContent.split('\n').filter(Boolean) : [];

  try { fs.rmSync(stepEnv.tempDir, { recursive: true }); } catch { /* ignore */ }

  return { outputs, envUpdates, pathAdditions };
}

/**
 * Handle exit-code failure for any step type. Sets conclusion, and throws
 * unless continue-on-error is enabled.
 */
function handleStepFailure(
  exitCode: number,
  step: Step,
  stepDef: StepDefinition,
  errorMessage: string,
): void {
  if (exitCode !== 0) {
    step.conclusion = 'failure';
    if (!stepDef['continue-on-error']) {
      throw new Error(errorMessage);
    }
  }
}

/**
 * Clean up a temp directory (for action step types that delegate output
 * parsing to their own runners and only need the temp dir for GITHUB_* env
 * var paths).
 */
function cleanupTempDir(tempDir: string): void {
  try { fs.rmSync(tempDir, { recursive: true }); } catch { /* ignore */ }
}

async function runShellStep(
  stepDef: StepDefinition,
  step: Step,
  opts: StepRunnerOpts,
): Promise<StepResult> {
  const command = evaluateExpression(stepDef.run!, opts.expressionCtx);
  const sEnv = prepareStepEnvironment(stepDef, step, opts, { tempPrefix: 'runner-step-', includeProcessEnv: true });

  // Determine shell (step-level overrides job defaults)
  const shell = stepDef.shell || opts.defaults?.shell || 'bash';
  let shellCmd: string;
  let shellArgs: string[];

  switch (shell) {
    case 'bash':
      shellCmd = 'bash';
      shellArgs = ['--noprofile', '--norc', '-eo', 'pipefail', '-c', command];
      break;
    case 'sh':
      shellCmd = 'sh';
      shellArgs = ['-e', '-c', command];
      break;
    case 'pwsh':
    case 'powershell':
      shellCmd = 'pwsh';
      shellArgs = ['-Command', command];
      break;
    case 'python':
      shellCmd = 'python3';
      shellArgs = ['-c', command];
      break;
    default:
      shellCmd = 'bash';
      shellArgs = ['--noprofile', '--norc', '-eo', 'pipefail', '-c', command];
  }

  const { exitCode, output } = await spawnCommand(shellCmd, shellArgs, {
    cwd: sEnv.cwd,
    env: sEnv.env,
    timeoutMs: sEnv.timeoutMs,
    signal: opts.signal,
    onOutput: sEnv.onOutput,
  });

  step.log += maskSecrets(output, sEnv.secretValues);

  const { outputs, envUpdates, pathAdditions } = collectStepOutputs(sEnv);

  handleStepFailure(exitCode, step, stepDef, `Step '${step.name}' failed with exit code ${exitCode}`);

  step.outputs = outputs;
  return { step, outputs, envUpdates, pathAdditions };
}

async function runUsesStep(
  stepDef: StepDefinition,
  step: Step,
  stepNumber: number,
  opts: StepRunnerOpts,
): Promise<StepResult> {
  const uses = stepDef.uses!;

  // Handle direct docker:// references
  if (uses.startsWith('docker://')) {
    const image = uses.slice('docker://'.length);
    step.log += `Running docker image: ${image}\n`;
    return await runDockerUsesStep(null, null, image, stepDef, step, opts);
  }

  // Resolve the action path (local or marketplace)
  const actionPath = await resolveActionPath(uses, opts.workspacePath);

  if (!actionPath) {
    step.log += `Warning: Could not resolve action '${uses}'. Skipping.\n`;
    step.conclusion = 'skipped';
    return { step, outputs: {}, envUpdates: {}, pathAdditions: [] };
  }

  if (!fs.existsSync(actionPath)) {
    throw new Error(`Action path does not exist: ${actionPath}`);
  }

  step.log += `Loading action from ${actionPath}\n`;
  const action = loadAction(actionPath);

  // Resolve inputs
  const actionInputs = resolveActionInputs(action, stepDef.with, opts.expressionCtx);

  const using = action.runs.using;

  if (using === 'composite') {
    return await runCompositeAction(action, actionInputs, step, stepNumber, actionPath, opts);
  }

  if (using === 'node12' || using === 'node16' || using === 'node20') {
    return await runNodeUsesStep(action, actionInputs, actionPath, stepDef, step, opts);
  }

  if (using === 'docker') {
    return await runDockerUsesStep(action, actionPath, null, stepDef, step, opts);
  }

  // Unknown action type
  step.log += `Warning: Unsupported action type '${using}'. Skipping.\n`;
  step.conclusion = 'skipped';
  return { step, outputs: {}, envUpdates: {}, pathAdditions: [] };
}

/**
 * Execute a Node.js-based action (node12, node16, node20).
 */
async function runNodeUsesStep(
  action: import('../types.js').ActionDefinition,
  actionInputs: Record<string, string>,
  actionPath: string,
  stepDef: StepDefinition,
  step: Step,
  opts: StepRunnerOpts,
): Promise<StepResult> {
  step.log += `Running Node.js action '${action.name}' (${action.runs.using})\n`;

  // Build INPUT_* env vars
  const inputEnv: Record<string, string> = {};
  for (const [name, value] of Object.entries(actionInputs)) {
    inputEnv[`INPUT_${name.toUpperCase()}`] = value;
  }

  const sEnv = prepareStepEnvironment(stepDef, step, opts, { tempPrefix: 'runner-node-step-' });

  const result = await runNodeAction({
    actionPath,
    action,
    inputEnv,
    env: sEnv.env,
    cwd: opts.workspacePath,
    timeoutMs: sEnv.timeoutMs,
    signal: opts.signal,
    onOutput: sEnv.onOutput,
  });

  step.log += maskSecrets(result.log, sEnv.secretValues);

  cleanupTempDir(sEnv.tempDir);

  handleStepFailure(result.exitCode, step, stepDef, `Node action '${action.name}' failed with exit code ${result.exitCode}`);

  step.outputs = result.outputs;
  return {
    step,
    outputs: result.outputs,
    envUpdates: result.envUpdates,
    pathAdditions: result.pathAdditions,
  };
}

/**
 * Execute a Docker-based action.
 */
async function runDockerUsesStep(
  action: import('../types.js').ActionDefinition | null,
  actionPath: string | null,
  dockerImage: string | null,
  stepDef: StepDefinition,
  step: Step,
  opts: StepRunnerOpts,
): Promise<StepResult> {
  const actionInputs = action
    ? resolveActionInputs(action, stepDef.with, opts.expressionCtx)
    : {};

  // Build INPUT_* env vars
  const inputEnv: Record<string, string> = {};
  for (const [name, value] of Object.entries(actionInputs)) {
    inputEnv[`INPUT_${name.toUpperCase()}`] = value;
  }

  // Also add any raw `with` values that aren't in the action definition
  if (stepDef.with) {
    for (const [k, v] of Object.entries(stepDef.with)) {
      const envKey = `INPUT_${k.toUpperCase()}`;
      if (!(envKey in inputEnv)) {
        inputEnv[envKey] = evaluateExpression(v, opts.expressionCtx);
      }
    }
  }

  step.log += action
    ? `Running Docker action '${action.name}'\n`
    : `Running Docker image: ${dockerImage}\n`;

  const sEnv = prepareStepEnvironment(stepDef, step, opts, { tempPrefix: 'runner-docker-step-' });

  // Resolve args from action.yml or step with.args
  let args: string[] | undefined;
  if (action?.runs.args) {
    args = action.runs.args.map(a => evaluateExpression(a, opts.expressionCtx));
  }

  const result = await runDockerAction({
    actionPath,
    action: action || null,
    dockerImage,
    inputEnv,
    env: sEnv.env,
    workspacePath: opts.workspacePath,
    args,
    entrypoint: action?.runs.entrypoint,
    timeoutMs: sEnv.timeoutMs,
    signal: opts.signal,
    onOutput: sEnv.onOutput,
  });

  step.log += maskSecrets(result.log, sEnv.secretValues);

  cleanupTempDir(sEnv.tempDir);

  handleStepFailure(result.exitCode, step, stepDef, `Docker action failed with exit code ${result.exitCode}`);

  step.outputs = result.outputs;
  return {
    step,
    outputs: result.outputs,
    envUpdates: result.envUpdates,
    pathAdditions: result.pathAdditions,
  };
}

async function runCompositeAction(
  action: import('../types.js').ActionDefinition,
  actionInputs: Record<string, string>,
  parentStep: Step,
  parentStepNumber: number,
  actionPath: string,
  opts: StepRunnerOpts,
): Promise<StepResult> {
  const { steps: compositeSteps, env: inputEnv } = getCompositeSteps(action, actionInputs);

  parentStep.log += `Running composite action '${action.name}' with ${compositeSteps.length} steps\n`;

  const allOutputs: Record<string, string> = {};
  const allEnvUpdates: Record<string, string> = {};
  const allPathAdditions: string[] = [];

  // Build a sub-context for the composite action
  const compositeCtx: ExpressionContext = {
    ...opts.expressionCtx,
    inputs: actionInputs,
    steps: {},
  };

  for (let i = 0; i < compositeSteps.length; i++) {
    const cStep = compositeSteps[i];

    // Merge the INPUT_ env vars into the step
    const mergedStep: StepDefinition = {
      ...cStep,
      env: { ...inputEnv, ...cStep.env },
    };

    // If the composite step has a relative working-directory, resolve it relative to the action
    if (mergedStep['working-directory'] && !path.isAbsolute(mergedStep['working-directory'])) {
      mergedStep['working-directory'] = path.resolve(actionPath, mergedStep['working-directory']);
    }

    const subOpts: StepRunnerOpts = {
      ...opts,
      expressionCtx: compositeCtx,
    };

    const result = await runStep(mergedStep, parentStepNumber * 100 + i + 1, subOpts);

    // Accumulate outputs and env updates
    Object.assign(allOutputs, result.outputs);
    Object.assign(allEnvUpdates, result.envUpdates);
    allPathAdditions.push(...result.pathAdditions);

    parentStep.log += result.step.log;

    // Update composite context with step outputs
    if (cStep.id) {
      compositeCtx.steps[cStep.id] = {
        outputs: result.outputs,
        outcome: result.step.conclusion || 'success',
        conclusion: result.step.conclusion || 'success',
      };
    }

    // If a step failed and it's not continue-on-error, stop
    if (result.step.conclusion === 'failure' && !cStep['continue-on-error']) {
      parentStep.conclusion = 'failure';
      break;
    }
  }

  // Resolve composite action outputs
  const actionOutputs = resolveCompositeOutputs(action, compositeCtx);
  Object.assign(allOutputs, actionOutputs);

  parentStep.outputs = allOutputs;
  return { step: parentStep, outputs: allOutputs, envUpdates: allEnvUpdates, pathAdditions: allPathAdditions };
}

// ── Helpers ──

interface SpawnOpts {
  cwd: string;
  env: Record<string, string>;
  timeoutMs: number;
  signal?: AbortSignal;
  onOutput?: (line: string) => void;
}

function spawnCommand(
  cmd: string,
  args: string[],
  opts: SpawnOpts,
): Promise<{ exitCode: number; output: string }> {
  return new Promise((resolve, reject) => {
    let output = '';
    let child: ChildProcess;

    try {
      child = spawn(cmd, args, {
        cwd: opts.cwd,
        env: opts.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      return reject(new Error(`Failed to spawn '${cmd}': ${err}`));
    }

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 5000);
      reject(new Error(`Command timed out after ${opts.timeoutMs}ms`));
    }, opts.timeoutMs);

    if (opts.signal) {
      opts.signal.addEventListener('abort', () => {
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 5000);
        clearTimeout(timeout);
        reject(new Error('Cancelled'));
      }, { once: true });
    }

    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      output += text;
      if (opts.onOutput) {
        // Emit line-by-line, but buffer partial lines
        const lines = text.split('\n');
        for (const line of lines) {
          if (line) opts.onOutput(line + '\n');
        }
      }
    });

    child.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      output += text;
      if (opts.onOutput) {
        const lines = text.split('\n');
        for (const line of lines) {
          if (line) opts.onOutput(line + '\n');
        }
      }
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      resolve({ exitCode: code ?? 1, output: '' }); // output already streamed via onOutput
    });
  });
}

/**
 * Parse a GITHUB_OUTPUT or GITHUB_ENV style key-value file.
 * Supports both `key=value` (single-line) and heredoc-style multiline:
 *   key<<delimiter
 *   value lines
 *   delimiter
 */
export function parseKeyValueFile(filePath: string): Record<string, string> {
  const result: Record<string, string> = {};

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (!content.trim()) return result;

    const lines = content.split('\n');
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Heredoc style: key<<DELIMITER
      const heredocMatch = line.match(/^(.+?)<<(.+)$/);
      if (heredocMatch) {
        const key = heredocMatch[1];
        const delimiter = heredocMatch[2];
        const valueLines: string[] = [];
        i++;
        while (i < lines.length && lines[i] !== delimiter) {
          valueLines.push(lines[i]);
          i++;
        }
        result[key] = valueLines.join('\n');
        i++;
        continue;
      }

      // Simple key=value
      const eqIdx = line.indexOf('=');
      if (eqIdx > 0) {
        const key = line.slice(0, eqIdx);
        const value = line.slice(eqIdx + 1);
        result[key] = value;
      }

      i++;
    }
  } catch {
    // File might not exist or be empty
  }

  return result;
}

function resolveEnv(env: Record<string, string>, ctx: ExpressionContext): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    resolved[k] = evaluateExpression(String(v), ctx);
  }
  return resolved;
}

/**
 * Replace any occurrence of secret values in text with '***'.
 * Only masks non-empty values to avoid replacing empty strings everywhere.
 */
export function maskSecrets(text: string, secretValues: string[]): string {
  let masked = text;
  for (const secret of secretValues) {
    if (secret.length > 0) {
      // Use split+join instead of regex to avoid special regex characters in secrets
      masked = masked.split(secret).join('***');
    }
  }
  return masked;
}
