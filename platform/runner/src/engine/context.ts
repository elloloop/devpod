import { ExpressionContext } from '../types.js';
import { execSync } from 'node:child_process';
import * as path from 'node:path';
import * as os from 'node:os';

/**
 * Build the full expression context for evaluating ${{ }} expressions.
 */
export function buildExpressionContext(opts: {
  workspacePath: string;
  event: string;
  ref: string;
  sha: string;
  workflowEnv: Record<string, string>;
  jobEnv: Record<string, string>;
  stepEnv: Record<string, string>;
  inputs: Record<string, string>;
  steps: Record<string, { outputs: Record<string, string>; outcome: string; conclusion: string }>;
  needs: Record<string, { outputs: Record<string, string>; result: string }>;
  jobs: Record<string, { outputs: Record<string, string> }>;
  matrix?: Record<string, string>;
  secrets?: Record<string, string>;
}): ExpressionContext {
  const mergedEnv = {
    ...opts.workflowEnv,
    ...opts.jobEnv,
    ...opts.stepEnv,
  };

  let repoName = 'local/repo';
  try {
    const remote = execSync('git remote get-url origin', {
      cwd: opts.workspacePath,
      encoding: 'utf-8',
    }).trim();
    const match = remote.match(/[:/]([^/]+\/[^/.]+?)(?:\.git)?$/);
    if (match) repoName = match[1];
  } catch {
    repoName = path.basename(opts.workspacePath);
  }

  let actor = 'local';
  try {
    actor = execSync('git config user.name', {
      cwd: opts.workspacePath,
      encoding: 'utf-8',
    }).trim() || 'local';
  } catch {
    // keep default
  }

  return {
    github: {
      event_name: opts.event,
      ref: opts.ref,
      sha: opts.sha,
      repository: repoName,
      workspace: opts.workspacePath,
      actor,
      run_id: '',
      run_number: '1',
      job: '',
      action: '',
      action_path: '',
      workflow: '',
      server_url: 'https://github.com',
      api_url: 'https://api.github.com',
      token: process.env.GITHUB_TOKEN || '',
      event: {},
    },
    env: mergedEnv,
    inputs: opts.inputs,
    steps: opts.steps,
    needs: opts.needs,
    jobs: opts.jobs,
    runner: {
      os: process.platform === 'darwin' ? 'macOS' : process.platform === 'win32' ? 'Windows' : 'Linux',
      arch: os.arch(),
      name: 'local-runner',
      temp: os.tmpdir(),
      tool_cache: path.join(os.tmpdir(), 'runner-tool-cache'),
    },
    matrix: opts.matrix || {},
    secrets: {
      GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
      ...opts.secrets,
    },
  };
}

/**
 * Build environment variables that GitHub Actions normally injects.
 */
export function buildGitHubEnv(opts: {
  workspacePath: string;
  runId: string;
  event: string;
  ref: string;
  sha: string;
  workflow: string;
  job: string;
  githubOutputFile: string;
  githubEnvFile: string;
  githubStepSummaryFile: string;
  githubPathFile: string;
}): Record<string, string> {
  return {
    CI: 'true',
    GITHUB_ACTIONS: 'true',
    GITHUB_WORKSPACE: opts.workspacePath,
    GITHUB_RUN_ID: opts.runId,
    GITHUB_RUN_NUMBER: '1',
    GITHUB_EVENT_NAME: opts.event,
    GITHUB_REF: opts.ref,
    GITHUB_SHA: opts.sha,
    GITHUB_WORKFLOW: opts.workflow,
    GITHUB_JOB: opts.job,
    GITHUB_OUTPUT: opts.githubOutputFile,
    GITHUB_ENV: opts.githubEnvFile,
    GITHUB_STEP_SUMMARY: opts.githubStepSummaryFile,
    GITHUB_PATH: opts.githubPathFile,
    GITHUB_SERVER_URL: 'https://github.com',
    GITHUB_API_URL: 'https://api.github.com',
    RUNNER_OS: process.platform === 'darwin' ? 'macOS' : process.platform === 'win32' ? 'Windows' : 'Linux',
    RUNNER_ARCH: process.arch === 'arm64' ? 'ARM64' : 'X64',
    RUNNER_TEMP: opts.workspacePath,
    RUNNER_TOOL_CACHE: path.join(opts.workspacePath, '.tool-cache'),
  };
}
