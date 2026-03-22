import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  parseWorkflowFile,
  discoverWorkflows,
  findWorkflow,
  listWorkflows,
  getWorkflowInfo,
} from './parser.js';

let tmpDir: string;

function writeWorkflow(filename: string, content: string): string {
  const workflowDir = path.join(tmpDir, '.github', 'workflows');
  fs.mkdirSync(workflowDir, { recursive: true });
  const filePath = path.join(workflowDir, filename);
  fs.writeFileSync(filePath, content);
  return filePath;
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('parseWorkflowFile', () => {
  it('parses a simple workflow with one job', () => {
    const filePath = writeWorkflow('simple.yml', `
name: Simple
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo hello
`);
    const wf = parseWorkflowFile(filePath);
    expect(wf.name).toBe('Simple');
    expect(wf.jobs.build).toBeDefined();
    expect(wf.jobs.build.steps).toHaveLength(1);
    expect(wf.jobs.build.steps[0].run).toBe('echo hello');
  });

  it('parses a workflow with job dependencies (needs)', () => {
    const filePath = writeWorkflow('deps.yml', `
name: Deps
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo build
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - run: echo deploy
`);
    const wf = parseWorkflowFile(filePath);
    expect(wf.jobs.deploy.needs).toBe('build');
  });

  it('parses a workflow with needs as array', () => {
    const filePath = writeWorkflow('deps-array.yml', `
name: DepsArray
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo build
  test:
    runs-on: ubuntu-latest
    steps:
      - run: echo test
  deploy:
    needs: [build, test]
    runs-on: ubuntu-latest
    steps:
      - run: echo deploy
`);
    const wf = parseWorkflowFile(filePath);
    expect(wf.jobs.deploy.needs).toEqual(['build', 'test']);
  });

  it('parses workflow_dispatch with inputs', () => {
    const filePath = writeWorkflow('dispatch.yml', `
name: Dispatch
on:
  workflow_dispatch:
    inputs:
      environment:
        description: Target environment
        required: true
        default: staging
        type: string
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - run: echo deploying
`);
    const wf = parseWorkflowFile(filePath);
    const on = wf.on as Record<string, unknown>;
    expect(on.workflow_dispatch).toBeDefined();
    const dispatch = on.workflow_dispatch as Record<string, unknown>;
    expect(dispatch.inputs).toBeDefined();
    const inputs = dispatch.inputs as Record<string, unknown>;
    expect(inputs.environment).toBeDefined();
  });

  it('parses push trigger with branches', () => {
    const filePath = writeWorkflow('push.yml', `
name: Push
on:
  push:
    branches: [main, develop]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo build
`);
    const wf = parseWorkflowFile(filePath);
    const on = wf.on as Record<string, unknown>;
    const push = on.push as Record<string, unknown>;
    expect(push.branches).toEqual(['main', 'develop']);
  });

  it('parses job defaults (working-directory, shell)', () => {
    const filePath = writeWorkflow('defaults.yml', `
name: Defaults
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./src
        shell: bash
    steps:
      - run: echo hello
`);
    const wf = parseWorkflowFile(filePath);
    expect(wf.jobs.build.defaults).toBeDefined();
    expect(wf.jobs.build.defaults!.run!['working-directory']).toBe('./src');
    expect(wf.jobs.build.defaults!.run!.shell).toBe('bash');
  });

  it('parses matrix strategy', () => {
    const filePath = writeWorkflow('matrix.yml', `
name: Matrix
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [18, 20]
        os: [linux, mac]
      fail-fast: false
      max-parallel: 2
    steps:
      - run: echo hello
`);
    const wf = parseWorkflowFile(filePath);
    expect(wf.jobs.build.strategy).toBeDefined();
    expect(wf.jobs.build.strategy!.matrix.node).toEqual([18, 20]);
    expect(wf.jobs.build.strategy!.matrix.os).toEqual(['linux', 'mac']);
    expect(wf.jobs.build.strategy!['fail-fast']).toBe(false);
    expect(wf.jobs.build.strategy!['max-parallel']).toBe(2);
  });

  it('parses services', () => {
    const filePath = writeWorkflow('services.yml', `
name: Services
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        ports:
          - "5432:5432"
        env:
          POSTGRES_PASSWORD: test
    steps:
      - run: echo test
`);
    const wf = parseWorkflowFile(filePath);
    expect(wf.jobs.test.services).toBeDefined();
    expect(wf.jobs.test.services!.postgres.image).toBe('postgres:15');
    expect(wf.jobs.test.services!.postgres.ports).toEqual(['5432:5432']);
    expect(wf.jobs.test.services!.postgres.env).toEqual({ POSTGRES_PASSWORD: 'test' });
  });

  it('parses step definitions (run, uses, with, env, if, working-directory)', () => {
    const filePath = writeWorkflow('steps.yml', `
name: Steps
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Build
        run: make build
        env:
          NODE_ENV: production
        if: success()
        working-directory: ./app
        shell: bash
`);
    const wf = parseWorkflowFile(filePath);
    const steps = wf.jobs.build.steps;
    expect(steps).toHaveLength(2);

    expect(steps[0].uses).toBe('actions/checkout@v4');
    expect(steps[0].with).toEqual({ 'fetch-depth': '0' });

    expect(steps[1].name).toBe('Build');
    expect(steps[1].run).toBe('make build');
    expect(steps[1].env).toEqual({ NODE_ENV: 'production' });
    expect(steps[1].if).toBe('success()');
    expect(steps[1]['working-directory']).toBe('./app');
    expect(steps[1].shell).toBe('bash');
  });

  it('normalizes env to convert all values to strings', () => {
    const filePath = writeWorkflow('env.yml', `
name: Env
on: push
env:
  NUM: 42
  BOOL: true
  STR: hello
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo test
`);
    const wf = parseWorkflowFile(filePath);
    expect(wf.env).toEqual({ NUM: '42', BOOL: 'true', STR: 'hello' });
  });

  it('handles missing on field gracefully', () => {
    const filePath = writeWorkflow('no-on.yml', `
name: NoOn
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo test
`);
    const wf = parseWorkflowFile(filePath);
    // normalizeOn returns { workflow_dispatch: {} } for missing on
    expect(wf.on).toEqual({ workflow_dispatch: {} });
  });

  it('handles missing jobs field gracefully', () => {
    const filePath = writeWorkflow('no-jobs.yml', `
name: NoJobs
on: push
`);
    const wf = parseWorkflowFile(filePath);
    expect(wf.jobs).toEqual({});
  });

  it('uses filename as name when name field is missing', () => {
    const filePath = writeWorkflow('unnamed.yml', `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo test
`);
    const wf = parseWorkflowFile(filePath);
    expect(wf.name).toBe('unnamed');
  });
});

describe('discoverWorkflows', () => {
  it('finds all yml and yaml files', () => {
    writeWorkflow('a.yml', 'name: A\non: push\njobs: {}');
    writeWorkflow('b.yaml', 'name: B\non: push\njobs: {}');
    // Write a non-workflow file
    fs.writeFileSync(path.join(tmpDir, '.github', 'workflows', 'readme.txt'), 'not a workflow');

    const files = discoverWorkflows(tmpDir);
    expect(files).toHaveLength(2);
    expect(files[0]).toContain('a.yml');
    expect(files[1]).toContain('b.yaml');
  });

  it('returns empty array when .github/workflows does not exist', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'empty-'));
    try {
      const files = discoverWorkflows(emptyDir);
      expect(files).toEqual([]);
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  it('returns sorted results', () => {
    writeWorkflow('z.yml', 'name: Z\non: push\njobs: {}');
    writeWorkflow('a.yml', 'name: A\non: push\njobs: {}');
    writeWorkflow('m.yml', 'name: M\non: push\njobs: {}');

    const files = discoverWorkflows(tmpDir);
    const names = files.map(f => path.basename(f));
    expect(names).toEqual(['a.yml', 'm.yml', 'z.yml']);
  });
});

describe('getWorkflowInfo', () => {
  it('returns workflow info with triggers and jobs', () => {
    const filePath = writeWorkflow('ci.yml', `
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo build
  test:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - run: echo test
`);
    const info = getWorkflowInfo(filePath);
    expect(info.name).toBe('CI');
    expect(info.fileName).toBe('ci.yml');
    expect(info.triggers).toEqual(['push', 'pull_request']);
    expect(info.jobs).toHaveLength(2);
    expect(info.jobs[1].needs).toEqual(['build']);
  });

  it('extracts workflow_dispatch inputs', () => {
    const filePath = writeWorkflow('dispatch.yml', `
name: Deploy
on:
  workflow_dispatch:
    inputs:
      env:
        description: Target
        required: true
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - run: echo deploy
`);
    const info = getWorkflowInfo(filePath);
    expect(info.inputs).toBeDefined();
    expect(info.inputs!.env).toBeDefined();
    expect(info.inputs!.env.description).toBe('Target');
  });
});

describe('findWorkflow', () => {
  it('finds workflow by filename without extension', () => {
    writeWorkflow('ci.yml', `
name: CI Pipeline
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo build
`);
    const result = findWorkflow(tmpDir, 'ci');
    expect(result).not.toBeNull();
    expect(result!.workflow.name).toBe('CI Pipeline');
  });

  it('finds workflow by full filename', () => {
    writeWorkflow('ci.yml', `
name: CI Pipeline
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo build
`);
    const result = findWorkflow(tmpDir, 'ci.yml');
    expect(result).not.toBeNull();
  });

  it('finds workflow by name field', () => {
    writeWorkflow('ci.yml', `
name: CI Pipeline
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo build
`);
    const result = findWorkflow(tmpDir, 'CI Pipeline');
    expect(result).not.toBeNull();
    expect(result!.workflow.name).toBe('CI Pipeline');
  });

  it('returns null for non-existent workflow', () => {
    writeWorkflow('ci.yml', 'name: CI\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo');
    const result = findWorkflow(tmpDir, 'nonexistent');
    expect(result).toBeNull();
  });
});

describe('listWorkflows', () => {
  it('lists all workflows with info', () => {
    writeWorkflow('ci.yml', `
name: CI
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo build
`);
    writeWorkflow('deploy.yml', `
name: Deploy
on: workflow_dispatch
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - run: echo deploy
`);
    const workflows = listWorkflows(tmpDir);
    expect(workflows).toHaveLength(2);
    const names = workflows.map(w => w.name);
    expect(names).toContain('CI');
    expect(names).toContain('Deploy');
  });

  it('returns empty array for empty workspace', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'empty-'));
    try {
      const workflows = listWorkflows(emptyDir);
      expect(workflows).toEqual([]);
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });
});

describe('parseWorkflowFile edge cases', () => {
  it('parses workflow with reusable workflow call (job with uses instead of steps)', () => {
    const filePath = writeWorkflow('reusable-caller.yml', `
name: Caller
on: push
jobs:
  call-tests:
    uses: ./.github/workflows/tests.yml
    with:
      environment: staging
    secrets: inherit
`);
    const wf = parseWorkflowFile(filePath);
    expect(wf.jobs['call-tests']).toBeDefined();
    expect(wf.jobs['call-tests'].uses).toBe('./.github/workflows/tests.yml');
    expect(wf.jobs['call-tests'].with).toEqual({ environment: 'staging' });
    expect(wf.jobs['call-tests'].secrets).toBe('inherit');
    expect(wf.jobs['call-tests'].steps).toEqual([]);
  });

  it('parses workflow_call trigger with inputs/secrets/outputs', () => {
    const filePath = writeWorkflow('callable.yml', `
name: Callable
on:
  workflow_call:
    inputs:
      environment:
        description: Target environment
        required: true
        type: string
    secrets:
      deploy_key:
        description: Deployment key
        required: true
    outputs:
      result:
        description: Deployment result
        value: success
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - run: echo deploying
`);
    const wf = parseWorkflowFile(filePath);
    const on = wf.on as Record<string, unknown>;
    expect(on.workflow_call).toBeDefined();
    const callTrigger = on.workflow_call as Record<string, unknown>;
    expect(callTrigger.inputs).toBeDefined();
    expect(callTrigger.secrets).toBeDefined();
    expect(callTrigger.outputs).toBeDefined();
  });

  it('parses concurrency group without crashing', () => {
    const filePath = writeWorkflow('concurrency.yml', `
name: Concurrency
on: push
concurrency:
  group: ci-\${{ github.ref }}
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo build
`);
    // Should not throw
    const wf = parseWorkflowFile(filePath);
    expect(wf.name).toBe('Concurrency');
    expect(wf.jobs.build).toBeDefined();
  });

  it('parses job with strategy.matrix including include/exclude', () => {
    const filePath = writeWorkflow('matrix-full.yml', `
name: MatrixFull
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [18, 20]
        os: [linux, mac]
        include:
          - node: 22
            os: linux
            experimental: true
        exclude:
          - node: 18
            os: mac
    steps:
      - run: echo hello
`);
    const wf = parseWorkflowFile(filePath);
    expect(wf.jobs.build.strategy).toBeDefined();
    expect(wf.jobs.build.strategy!.matrix.include).toHaveLength(1);
    expect(wf.jobs.build.strategy!.matrix.exclude).toHaveLength(1);
  });

  it('throws on malformed YAML', () => {
    const filePath = writeWorkflow('malformed.yml', `
name: Malformed
on: push
jobs:
  build:
    - this is not valid yaml for a job
      bad: [indentation
`);
    // Severely malformed YAML should throw a parse error
    expect(() => parseWorkflowFile(filePath)).toThrow();
  });

  it('handles empty workflow file gracefully', () => {
    const filePath = writeWorkflow('empty.yml', '');
    expect(() => parseWorkflowFile(filePath)).toThrow();
  });

  it('parses workflow with no jobs as empty jobs record', () => {
    const filePath = writeWorkflow('no-jobs.yml', `
name: NoJobs
on: push
`);
    const wf = parseWorkflowFile(filePath);
    expect(wf.jobs).toEqual({});
  });

  it('parses job with outputs', () => {
    const filePath = writeWorkflow('outputs.yml', `
name: Outputs
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      result: \${{ steps.build.outputs.result }}
    steps:
      - id: build
        run: echo "result=ok" >> $GITHUB_OUTPUT
`);
    const wf = parseWorkflowFile(filePath);
    expect(wf.jobs.build.outputs).toBeDefined();
    expect(wf.jobs.build.outputs!.result).toBe('${{ steps.build.outputs.result }}');
  });

  it('parses job with continue-on-error and timeout-minutes on steps', () => {
    const filePath = writeWorkflow('step-opts.yml', `
name: StepOpts
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo flaky
        continue-on-error: true
        timeout-minutes: 5
`);
    const wf = parseWorkflowFile(filePath);
    expect(wf.jobs.build.steps[0]['continue-on-error']).toBe(true);
    expect(wf.jobs.build.steps[0]['timeout-minutes']).toBe(5);
  });

  it('parses reusable workflow call with explicit secrets mapping', () => {
    const filePath = writeWorkflow('explicit-secrets.yml', `
name: ExplicitSecrets
on: push
jobs:
  call-tests:
    uses: ./.github/workflows/tests.yml
    secrets:
      DEPLOY_KEY: \${{ secrets.MY_DEPLOY_KEY }}
      API_TOKEN: \${{ secrets.API_TOKEN }}
`);
    const wf = parseWorkflowFile(filePath);
    const job = wf.jobs['call-tests'];
    expect(job.secrets).toEqual({
      DEPLOY_KEY: '${{ secrets.MY_DEPLOY_KEY }}',
      API_TOKEN: '${{ secrets.API_TOKEN }}',
    });
  });
});
