import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { buildExpressionContext, buildGitHubEnv } from './context.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'context-test-'));
});

afterEach(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* */ }
});

describe('buildExpressionContext', () => {
  it('includes github.* properties', () => {
    const ctx = buildExpressionContext({
      workspacePath: tmpDir,
      event: 'push',
      ref: 'refs/heads/main',
      sha: 'abc123',
      workflowEnv: {},
      jobEnv: {},
      stepEnv: {},
      inputs: {},
      steps: {},
      needs: {},
      jobs: {},
    });

    expect(ctx.github).toBeDefined();
    expect(ctx.github.event_name).toBe('push');
    expect(ctx.github.ref).toBe('refs/heads/main');
    expect(ctx.github.sha).toBe('abc123');
    expect(ctx.github.workspace).toBe(tmpDir);
    expect(ctx.github.server_url).toBe('https://github.com');
    expect(ctx.github.api_url).toBe('https://api.github.com');
  });

  it('includes env.* from merged workflow, job, and step envs', () => {
    const ctx = buildExpressionContext({
      workspacePath: tmpDir,
      event: 'push',
      ref: 'refs/heads/main',
      sha: 'abc123',
      workflowEnv: { WF: 'wf-val', SHARED: 'wf' },
      jobEnv: { JOB: 'job-val', SHARED: 'job' },
      stepEnv: { STEP: 'step-val', SHARED: 'step' },
      inputs: {},
      steps: {},
      needs: {},
      jobs: {},
    });

    expect(ctx.env.WF).toBe('wf-val');
    expect(ctx.env.JOB).toBe('job-val');
    expect(ctx.env.STEP).toBe('step-val');
    // Step env overrides job env which overrides workflow env
    expect(ctx.env.SHARED).toBe('step');
  });

  it('includes inputs.*', () => {
    const ctx = buildExpressionContext({
      workspacePath: tmpDir,
      event: 'workflow_dispatch',
      ref: 'refs/heads/main',
      sha: 'abc123',
      workflowEnv: {},
      jobEnv: {},
      stepEnv: {},
      inputs: { environment: 'staging', debug: 'true' },
      steps: {},
      needs: {},
      jobs: {},
    });

    expect(ctx.inputs.environment).toBe('staging');
    expect(ctx.inputs.debug).toBe('true');
  });

  it('includes steps.* context', () => {
    const ctx = buildExpressionContext({
      workspacePath: tmpDir,
      event: 'push',
      ref: 'refs/heads/main',
      sha: 'abc123',
      workflowEnv: {},
      jobEnv: {},
      stepEnv: {},
      inputs: {},
      steps: {
        build: { outputs: { artifact: 'dist.zip' }, outcome: 'success', conclusion: 'success' },
      },
      needs: {},
      jobs: {},
    });

    expect(ctx.steps.build).toBeDefined();
    expect(ctx.steps.build.outputs.artifact).toBe('dist.zip');
    expect(ctx.steps.build.outcome).toBe('success');
  });

  it('includes needs.* context', () => {
    const ctx = buildExpressionContext({
      workspacePath: tmpDir,
      event: 'push',
      ref: 'refs/heads/main',
      sha: 'abc123',
      workflowEnv: {},
      jobEnv: {},
      stepEnv: {},
      inputs: {},
      steps: {},
      needs: {
        build: { outputs: { version: '1.0.0' }, result: 'success' },
      },
      jobs: {},
    });

    expect(ctx.needs.build).toBeDefined();
    expect(ctx.needs.build.outputs.version).toBe('1.0.0');
    expect(ctx.needs.build.result).toBe('success');
  });

  it('includes matrix.* context', () => {
    const ctx = buildExpressionContext({
      workspacePath: tmpDir,
      event: 'push',
      ref: 'refs/heads/main',
      sha: 'abc123',
      workflowEnv: {},
      jobEnv: {},
      stepEnv: {},
      inputs: {},
      steps: {},
      needs: {},
      jobs: {},
      matrix: { os: 'linux', version: '20' },
    });

    expect(ctx.matrix.os).toBe('linux');
    expect(ctx.matrix.version).toBe('20');
  });

  it('secrets are populated correctly', () => {
    const ctx = buildExpressionContext({
      workspacePath: tmpDir,
      event: 'push',
      ref: 'refs/heads/main',
      sha: 'abc123',
      workflowEnv: {},
      jobEnv: {},
      stepEnv: {},
      inputs: {},
      steps: {},
      needs: {},
      jobs: {},
      secrets: { MY_SECRET: 'secret-value', DEPLOY_KEY: 'deploy-key' },
    });

    expect(ctx.secrets.MY_SECRET).toBe('secret-value');
    expect(ctx.secrets.DEPLOY_KEY).toBe('deploy-key');
    expect(ctx.secrets.GITHUB_TOKEN).toBeDefined();
  });

  it('runner.os is correct for current platform', () => {
    const ctx = buildExpressionContext({
      workspacePath: tmpDir,
      event: 'push',
      ref: 'refs/heads/main',
      sha: 'abc123',
      workflowEnv: {},
      jobEnv: {},
      stepEnv: {},
      inputs: {},
      steps: {},
      needs: {},
      jobs: {},
    });

    const expectedOs = process.platform === 'darwin' ? 'macOS' : process.platform === 'win32' ? 'Windows' : 'Linux';
    expect(ctx.runner.os).toBe(expectedOs);
    expect(ctx.runner.name).toBe('local-runner');
    expect(ctx.runner.arch).toBeDefined();
    expect(ctx.runner.temp).toBeDefined();
  });

  it('github.workspace matches workspace path', () => {
    const ctx = buildExpressionContext({
      workspacePath: tmpDir,
      event: 'push',
      ref: 'refs/heads/main',
      sha: 'abc123',
      workflowEnv: {},
      jobEnv: {},
      stepEnv: {},
      inputs: {},
      steps: {},
      needs: {},
      jobs: {},
    });

    expect(ctx.github.workspace).toBe(tmpDir);
  });

  it('includes jobs.* context', () => {
    const ctx = buildExpressionContext({
      workspacePath: tmpDir,
      event: 'push',
      ref: 'refs/heads/main',
      sha: 'abc123',
      workflowEnv: {},
      jobEnv: {},
      stepEnv: {},
      inputs: {},
      steps: {},
      needs: {},
      jobs: {
        build: { outputs: { version: '2.0' } },
      },
    });

    expect(ctx.jobs.build).toBeDefined();
    expect(ctx.jobs.build.outputs.version).toBe('2.0');
  });

  it('defaults matrix to empty object when not provided', () => {
    const ctx = buildExpressionContext({
      workspacePath: tmpDir,
      event: 'push',
      ref: 'refs/heads/main',
      sha: 'abc123',
      workflowEnv: {},
      jobEnv: {},
      stepEnv: {},
      inputs: {},
      steps: {},
      needs: {},
      jobs: {},
    });

    expect(ctx.matrix).toEqual({});
  });
});

describe('buildGitHubEnv', () => {
  it('includes CI=true and GITHUB_ACTIONS=true', () => {
    const env = buildGitHubEnv({
      workspacePath: tmpDir,
      runId: 'run-123',
      event: 'push',
      ref: 'refs/heads/main',
      sha: 'abc123',
      workflow: 'CI',
      job: 'build',
      githubOutputFile: '/tmp/output',
      githubEnvFile: '/tmp/env',
      githubStepSummaryFile: '/tmp/summary',
      githubPathFile: '/tmp/path',
    });

    expect(env.CI).toBe('true');
    expect(env.GITHUB_ACTIONS).toBe('true');
  });

  it('includes all GITHUB_* env vars', () => {
    const env = buildGitHubEnv({
      workspacePath: tmpDir,
      runId: 'run-456',
      event: 'pull_request',
      ref: 'refs/pull/1/merge',
      sha: 'def456',
      workflow: 'PR Check',
      job: 'test',
      githubOutputFile: '/tmp/output',
      githubEnvFile: '/tmp/env',
      githubStepSummaryFile: '/tmp/summary',
      githubPathFile: '/tmp/path',
    });

    expect(env.GITHUB_WORKSPACE).toBe(tmpDir);
    expect(env.GITHUB_RUN_ID).toBe('run-456');
    expect(env.GITHUB_EVENT_NAME).toBe('pull_request');
    expect(env.GITHUB_REF).toBe('refs/pull/1/merge');
    expect(env.GITHUB_SHA).toBe('def456');
    expect(env.GITHUB_WORKFLOW).toBe('PR Check');
    expect(env.GITHUB_JOB).toBe('test');
    expect(env.GITHUB_SERVER_URL).toBe('https://github.com');
    expect(env.GITHUB_API_URL).toBe('https://api.github.com');
  });

  it('all GITHUB_* file paths are set', () => {
    const env = buildGitHubEnv({
      workspacePath: tmpDir,
      runId: 'run-789',
      event: 'push',
      ref: 'refs/heads/main',
      sha: 'abc123',
      workflow: 'CI',
      job: 'build',
      githubOutputFile: '/tmp/my-output',
      githubEnvFile: '/tmp/my-env',
      githubStepSummaryFile: '/tmp/my-summary',
      githubPathFile: '/tmp/my-path',
    });

    expect(env.GITHUB_OUTPUT).toBe('/tmp/my-output');
    expect(env.GITHUB_ENV).toBe('/tmp/my-env');
    expect(env.GITHUB_STEP_SUMMARY).toBe('/tmp/my-summary');
    expect(env.GITHUB_PATH).toBe('/tmp/my-path');
  });

  it('RUNNER_OS is correct for current platform', () => {
    const env = buildGitHubEnv({
      workspacePath: tmpDir,
      runId: 'run-os',
      event: 'push',
      ref: 'refs/heads/main',
      sha: 'abc123',
      workflow: 'CI',
      job: 'build',
      githubOutputFile: '/tmp/output',
      githubEnvFile: '/tmp/env',
      githubStepSummaryFile: '/tmp/summary',
      githubPathFile: '/tmp/path',
    });

    const expectedOs = process.platform === 'darwin' ? 'macOS' : process.platform === 'win32' ? 'Windows' : 'Linux';
    expect(env.RUNNER_OS).toBe(expectedOs);
  });

  it('RUNNER_ARCH is set based on process.arch', () => {
    const env = buildGitHubEnv({
      workspacePath: tmpDir,
      runId: 'run-arch',
      event: 'push',
      ref: 'refs/heads/main',
      sha: 'abc123',
      workflow: 'CI',
      job: 'build',
      githubOutputFile: '/tmp/output',
      githubEnvFile: '/tmp/env',
      githubStepSummaryFile: '/tmp/summary',
      githubPathFile: '/tmp/path',
    });

    const expectedArch = process.arch === 'arm64' ? 'ARM64' : 'X64';
    expect(env.RUNNER_ARCH).toBe(expectedArch);
  });

  it('GITHUB_RUN_NUMBER is set', () => {
    const env = buildGitHubEnv({
      workspacePath: tmpDir,
      runId: 'run-num',
      event: 'push',
      ref: 'refs/heads/main',
      sha: 'abc123',
      workflow: 'CI',
      job: 'build',
      githubOutputFile: '/tmp/output',
      githubEnvFile: '/tmp/env',
      githubStepSummaryFile: '/tmp/summary',
      githubPathFile: '/tmp/path',
    });

    expect(env.GITHUB_RUN_NUMBER).toBe('1');
  });
});
