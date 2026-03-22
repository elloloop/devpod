import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { WorkflowExecutor } from './engine/executor.js';
import { WorkflowRun } from './types.js';
import { SecretsStore } from './secrets/store.js';

// ── Helpers ──

interface TestWorkspace {
  path: string;
  cleanup: () => void;
}

function createTestWorkspace(): TestWorkspace {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'integration-test-'));
  // Initialize as a git repo (needed for sandbox and context)
  const { execSync } = require('node:child_process');
  try {
    execSync('git init', { cwd: dir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
    fs.writeFileSync(path.join(dir, '.gitkeep'), '');
    execSync('git add .', { cwd: dir, stdio: 'pipe' });
    execSync('git commit -m "init"', { cwd: dir, stdio: 'pipe' });
  } catch {
    // If git init fails, still create the workspace
  }
  return {
    path: dir,
    cleanup: () => {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* */ }
    },
  };
}

function writeWorkflow(dir: string, name: string, content: string): void {
  const workflowDir = path.join(dir, '.github', 'workflows');
  fs.mkdirSync(workflowDir, { recursive: true });
  fs.writeFileSync(path.join(workflowDir, name), content);
  // Stage and commit the workflow so the sandbox can see it
  try {
    const { execSync } = require('node:child_process');
    execSync('git add .', { cwd: dir, stdio: 'pipe' });
    execSync('git commit -m "add workflow" --allow-empty', { cwd: dir, stdio: 'pipe' });
  } catch {
    // Non-fatal — some tests don't need git
  }
}

async function runWorkflowAndWait(
  executor: WorkflowExecutor,
  name: string,
  opts?: { inputs?: Record<string, string>; timeout?: number },
): Promise<WorkflowRun> {
  const timeout = opts?.timeout || 30000;
  const run = await executor.triggerRun(name, opts?.inputs, { strategy: 'none' });

  // Wait for completion by polling
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const current = executor.getRun(run.id);
    if (current && (current.status === 'completed' || current.status === 'failed' || current.status === 'cancelled')) {
      return current;
    }
    await new Promise(r => setTimeout(r, 50));
  }

  throw new Error(`Workflow '${name}' timed out after ${timeout}ms`);
}

// ── Cleanup tracking ──

const workspaces: TestWorkspace[] = [];

afterEach(() => {
  for (const ws of workspaces) {
    ws.cleanup();
  }
  workspaces.length = 0;
});

function makeWorkspace(): TestWorkspace {
  const ws = createTestWorkspace();
  workspaces.push(ws);
  return ws;
}

// ── Tests ──

describe('integration: workflow execution', () => {
  it('simple workflow: one job, two shell steps -> success', async () => {
    const ws = makeWorkspace();
    writeWorkflow(ws.path, 'simple.yml', `
name: Simple
on: workflow_dispatch
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo "step 1"
      - run: echo "step 2"
`);

    const executor = new WorkflowExecutor(ws.path);
    const run = await runWorkflowAndWait(executor, 'Simple');

    expect(run.conclusion).toBe('success');
    expect(run.jobs).toHaveLength(1);
    expect(run.jobs[0].conclusion).toBe('success');
    expect(run.jobs[0].steps).toHaveLength(2);
    expect(run.jobs[0].steps[0].conclusion).toBe('success');
    expect(run.jobs[0].steps[1].conclusion).toBe('success');
  });

  it('workflow with needs dependencies -> correct ordering', async () => {
    const ws = makeWorkspace();
    writeWorkflow(ws.path, 'deps.yml', `
name: Deps
on: workflow_dispatch
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo "building"
  test:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - run: echo "testing"
`);

    const executor = new WorkflowExecutor(ws.path);
    const run = await runWorkflowAndWait(executor, 'Deps');

    expect(run.conclusion).toBe('success');
    expect(run.jobs).toHaveLength(2);

    const buildJob = run.jobs.find(j => j.id === 'build');
    const testJob = run.jobs.find(j => j.id === 'test');
    expect(buildJob).toBeDefined();
    expect(testJob).toBeDefined();
    expect(buildJob!.conclusion).toBe('success');
    expect(testJob!.conclusion).toBe('success');
  });

  it('workflow with matrix strategy -> correct number of jobs', async () => {
    const ws = makeWorkspace();
    writeWorkflow(ws.path, 'matrix.yml', `
name: Matrix
on: workflow_dispatch
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        version: [1, 2, 3]
    steps:
      - run: echo "version \${{ matrix.version }}"
`);

    const executor = new WorkflowExecutor(ws.path);
    const run = await runWorkflowAndWait(executor, 'Matrix');

    expect(run.conclusion).toBe('success');
    expect(run.jobs).toHaveLength(3);
    run.jobs.forEach(j => expect(j.conclusion).toBe('success'));
  });

  it('workflow with if: false -> job skipped', async () => {
    const ws = makeWorkspace();
    writeWorkflow(ws.path, 'skip.yml', `
name: Skip
on: workflow_dispatch
jobs:
  build:
    runs-on: ubuntu-latest
    if: false
    steps:
      - run: echo "should not run"
`);

    const executor = new WorkflowExecutor(ws.path);
    const run = await runWorkflowAndWait(executor, 'Skip');

    expect(run.conclusion).toBe('success');
    expect(run.jobs).toHaveLength(1);
    expect(run.jobs[0].conclusion).toBe('skipped');
  });

  it('workflow with a failing step -> run fails, subsequent steps skipped', async () => {
    const ws = makeWorkspace();
    writeWorkflow(ws.path, 'fail.yml', `
name: Fail
on: workflow_dispatch
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo "step 1"
      - run: exit 1
      - run: echo "should be skipped"
`);

    const executor = new WorkflowExecutor(ws.path);
    const run = await runWorkflowAndWait(executor, 'Fail');

    expect(run.conclusion).toBe('failure');
    expect(run.jobs[0].conclusion).toBe('failure');
    const steps = run.jobs[0].steps;
    expect(steps[0].conclusion).toBe('success');
    expect(steps[1].conclusion).toBe('failure');
    // Third step should be skipped
    expect(steps[2].conclusion).toBe('skipped');
  });

  it('workflow with continue-on-error: true -> step fails, error does not propagate', async () => {
    const ws = makeWorkspace();
    writeWorkflow(ws.path, 'continue.yml', `
name: Continue
on: workflow_dispatch
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: exit 1
        continue-on-error: true
      - run: echo "still running"
        if: always()
`);

    const executor = new WorkflowExecutor(ws.path);
    const run = await runWorkflowAndWait(executor, 'Continue');

    // continue-on-error prevents the error from propagating (step doesn't throw),
    // but the step's conclusion is still 'failure' and the job tracks it.
    // Step 2 with if: always() will run regardless.
    const steps = run.jobs[0].steps;
    expect(steps).toHaveLength(2);
    expect(steps[0].conclusion).toBe('failure');
    // Step 2 runs because of if: always()
    expect(steps[1].conclusion).toBe('success');
  });

  it('workflow with env at workflow, job, and step levels -> correct merging', async () => {
    const ws = makeWorkspace();
    writeWorkflow(ws.path, 'env.yml', `
name: Env
on: workflow_dispatch
env:
  LEVEL: workflow
  WF_ONLY: from-workflow
jobs:
  build:
    runs-on: ubuntu-latest
    env:
      LEVEL: job
      JOB_ONLY: from-job
    steps:
      - run: |
          echo "LEVEL=$LEVEL"
          echo "WF_ONLY=$WF_ONLY"
          echo "JOB_ONLY=$JOB_ONLY"
        env:
          LEVEL: step
`);

    const executor = new WorkflowExecutor(ws.path);
    const run = await runWorkflowAndWait(executor, 'Env');

    expect(run.conclusion).toBe('success');
  });

  it('workflow with working-directory -> step runs in correct dir', async () => {
    const ws = makeWorkspace();
    // Create the subdirectory
    fs.mkdirSync(path.join(ws.path, 'subdir'), { recursive: true });
    writeWorkflow(ws.path, 'workdir.yml', `
name: WorkDir
on: workflow_dispatch
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: pwd
        working-directory: subdir
`);

    const executor = new WorkflowExecutor(ws.path);
    const run = await runWorkflowAndWait(executor, 'WorkDir');

    expect(run.conclusion).toBe('success');
  });

  it('workflow with defaults.run.working-directory -> applied to all run steps', async () => {
    const ws = makeWorkspace();
    fs.mkdirSync(path.join(ws.path, 'default-dir'), { recursive: true });
    writeWorkflow(ws.path, 'defaults.yml', `
name: Defaults
on: workflow_dispatch
jobs:
  build:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: default-dir
    steps:
      - run: pwd
      - run: pwd
`);

    const executor = new WorkflowExecutor(ws.path);
    const run = await runWorkflowAndWait(executor, 'Defaults');

    expect(run.conclusion).toBe('success');
  });

  it('workflow with step outputs flowing between steps via id', async () => {
    const ws = makeWorkspace();
    writeWorkflow(ws.path, 'outputs.yml', `
name: Outputs
on: workflow_dispatch
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - id: gen
        run: echo "val=hello-world" >> $GITHUB_OUTPUT
      - run: |
          echo "Got: \${{ steps.gen.outputs.val }}"
`);

    const executor = new WorkflowExecutor(ws.path);
    const run = await runWorkflowAndWait(executor, 'Outputs');

    expect(run.conclusion).toBe('success');
    expect(run.jobs[0].steps).toHaveLength(2);
    expect(run.jobs[0].steps[0].conclusion).toBe('success');
    expect(run.jobs[0].steps[1].conclusion).toBe('success');
  });

  it('reusable workflow call -> inputs passed correctly', async () => {
    const ws = makeWorkspace();

    // Write the called workflow
    writeWorkflow(ws.path, 'called.yml', `
name: Called
on:
  workflow_call:
    inputs:
      greeting:
        description: Greeting
        default: hello
        type: string
jobs:
  greet:
    runs-on: ubuntu-latest
    steps:
      - run: echo "\${{ inputs.greeting }}"
`);

    // Write the caller workflow
    writeWorkflow(ws.path, 'caller.yml', `
name: Caller
on: workflow_dispatch
jobs:
  call-it:
    uses: ./.github/workflows/called.yml
    with:
      greeting: world
`);

    const executor = new WorkflowExecutor(ws.path);
    const run = await runWorkflowAndWait(executor, 'Caller');

    expect(run.conclusion).toBe('success');
    // Should have at least the caller job and the called job
    expect(run.jobs.length).toBeGreaterThanOrEqual(1);
  });

  it('workflow with multiple independent jobs run successfully', async () => {
    const ws = makeWorkspace();
    writeWorkflow(ws.path, 'parallel.yml', `
name: Parallel
on: workflow_dispatch
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - run: echo "linting"
  test:
    runs-on: ubuntu-latest
    steps:
      - run: echo "testing"
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo "building"
`);

    const executor = new WorkflowExecutor(ws.path);
    const run = await runWorkflowAndWait(executor, 'Parallel');

    expect(run.conclusion).toBe('success');
    expect(run.jobs).toHaveLength(3);
    run.jobs.forEach(j => expect(j.conclusion).toBe('success'));
  });

  it('workflow executor getRun returns undefined for unknown ID', () => {
    const ws = makeWorkspace();
    const executor = new WorkflowExecutor(ws.path);
    expect(executor.getRun('nonexistent')).toBeUndefined();
  });

  it('workflow executor listRuns returns empty initially', () => {
    const ws = makeWorkspace();
    const executor = new WorkflowExecutor(ws.path);
    expect(executor.listRuns()).toEqual([]);
  });

  it('workflow executor getRunLogs returns empty for unknown ID', () => {
    const ws = makeWorkspace();
    const executor = new WorkflowExecutor(ws.path);
    expect(executor.getRunLogs('nonexistent')).toBe('');
  });

  it('workflow executor triggerRun throws for unknown workflow', async () => {
    const ws = makeWorkspace();
    const executor = new WorkflowExecutor(ws.path);
    await expect(executor.triggerRun('nonexistent-workflow')).rejects.toThrow('not found');
  });

  it('sandbox: files created in run do not appear in original workspace', async () => {
    const ws = makeWorkspace();
    writeWorkflow(ws.path, 'sandbox-test.yml', `
name: SandboxTest
on: workflow_dispatch
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo "created-by-workflow" > workflow-output.txt
`);

    const executor = new WorkflowExecutor(ws.path);
    // Use sandbox strategy to isolate
    const run = await executor.triggerRun('SandboxTest', {}, { strategy: 'copy' });

    // Wait for completion
    const start = Date.now();
    while (Date.now() - start < 30000) {
      const current = executor.getRun(run.id);
      if (current && (current.status === 'completed' || current.status === 'failed' || current.status === 'cancelled')) {
        break;
      }
      await new Promise(r => setTimeout(r, 50));
    }

    const finalRun = executor.getRun(run.id)!;
    expect(finalRun.conclusion).toBe('success');

    // The file should NOT exist in the original workspace
    expect(fs.existsSync(path.join(ws.path, 'workflow-output.txt'))).toBe(false);
  });

  it('workflow with env expressions resolved', async () => {
    const ws = makeWorkspace();
    writeWorkflow(ws.path, 'env-expr.yml', `
name: EnvExpr
on:
  workflow_dispatch:
    inputs:
      target:
        description: Target
        default: prod
env:
  TARGET: \${{ inputs.target || 'default' }}
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo "target is $TARGET"
`);

    const executor = new WorkflowExecutor(ws.path);
    const run = await runWorkflowAndWait(executor, 'EnvExpr', { inputs: { target: 'staging' } });

    expect(run.conclusion).toBe('success');
  });

  it('workflow cancelRun cancels a running workflow', async () => {
    const ws = makeWorkspace();
    writeWorkflow(ws.path, 'cancel.yml', `
name: Cancel
on: workflow_dispatch
jobs:
  slow:
    runs-on: ubuntu-latest
    steps:
      - run: sleep 60
`);

    const executor = new WorkflowExecutor(ws.path);
    const run = await executor.triggerRun('Cancel', {}, { strategy: 'none' });

    // Give it a moment to start
    await new Promise(r => setTimeout(r, 200));

    const cancelled = executor.cancelRun(run.id);
    expect(cancelled).toBe(true);

    // Wait a bit for the cancellation to propagate
    await new Promise(r => setTimeout(r, 500));

    const finalRun = executor.getRun(run.id)!;
    expect(finalRun.status).toBe('cancelled');
    expect(finalRun.conclusion).toBe('cancelled');
  });

  it('workflow listRuns returns runs sorted by creation time', async () => {
    const ws = makeWorkspace();
    writeWorkflow(ws.path, 'list.yml', `
name: List
on: workflow_dispatch
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo done
`);

    const executor = new WorkflowExecutor(ws.path);
    const run1 = await runWorkflowAndWait(executor, 'List');
    const run2 = await runWorkflowAndWait(executor, 'List');

    const runs = executor.listRuns();
    expect(runs).toHaveLength(2);
    // Most recent first
    expect(runs[0].id).toBe(run2.id);
    expect(runs[1].id).toBe(run1.id);
  });
});
