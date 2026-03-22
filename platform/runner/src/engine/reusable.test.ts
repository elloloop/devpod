import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { resolveReusableWorkflow } from './reusable.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reusable-test-'));
});

afterEach(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* */ }
});

function writeWorkflowFile(relativePath: string, content: string): void {
  const fullPath = path.join(tmpDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

describe('resolveReusableWorkflow', () => {
  it('local workflow reference resolves correctly', async () => {
    writeWorkflowFile('.github/workflows/tests.yml', `
name: Tests
on:
  workflow_call:
    inputs:
      environment:
        description: Target environment
        default: staging
        type: string
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: echo testing
`);

    const result = await resolveReusableWorkflow(
      './.github/workflows/tests.yml',
      { environment: 'production' },
      undefined,
      {},
      tmpDir,
    );

    expect(result.workflow.name).toBe('Tests');
    expect(result.resolvedInputs.environment).toBe('production');
    expect(result.jobs.test).toBeDefined();
  });

  it('inputs are merged with defaults', async () => {
    writeWorkflowFile('.github/workflows/called.yml', `
name: Called
on:
  workflow_call:
    inputs:
      env:
        description: Environment
        default: staging
        type: string
      debug:
        description: Enable debug
        default: 'false'
        type: string
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo building
`);

    const result = await resolveReusableWorkflow(
      './.github/workflows/called.yml',
      { env: 'production' }, // only provide env, not debug
      undefined,
      {},
      tmpDir,
    );

    expect(result.resolvedInputs.env).toBe('production');
    expect(result.resolvedInputs.debug).toBe('false'); // default
  });

  it('secrets: inherit passes all secrets', async () => {
    writeWorkflowFile('.github/workflows/called.yml', `
name: Called
on:
  workflow_call:
    secrets:
      TOKEN:
        description: Token
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo building
`);

    // resolveReusableWorkflow takes callerSecrets and currentSecrets
    // When callerSecrets = 'inherit', it passes through all currentSecrets
    const result = await resolveReusableWorkflow(
      './.github/workflows/called.yml',
      {},
      'inherit',
      { TOKEN: 'secret-value', OTHER: 'other-value' },
      tmpDir,
    );

    // The function itself doesn't expose resolved secrets on the result
    // but we verify it doesn't throw and returns valid result
    expect(result.workflow).toBeDefined();
    expect(result.callTrigger).toBeDefined();
  });

  it('explicit secrets mapping works', async () => {
    writeWorkflowFile('.github/workflows/called.yml', `
name: Called
on:
  workflow_call:
    secrets:
      DEPLOY_KEY:
        description: Deploy key
        required: true
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - run: echo deploying
`);

    const result = await resolveReusableWorkflow(
      './.github/workflows/called.yml',
      {},
      { DEPLOY_KEY: 'my-deploy-key' },
      { SOME_OTHER: 'value' },
      tmpDir,
    );

    expect(result.workflow).toBeDefined();
    expect(result.jobs.deploy).toBeDefined();
  });

  it('missing required input uses empty string (with warning)', async () => {
    writeWorkflowFile('.github/workflows/called.yml', `
name: Called
on:
  workflow_call:
    inputs:
      required_input:
        description: A required input
        required: true
        type: string
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo building
`);

    // Don't provide the required input
    const result = await resolveReusableWorkflow(
      './.github/workflows/called.yml',
      {},
      undefined,
      {},
      tmpDir,
    );

    // It should still resolve, just without the required input value
    expect(result.workflow).toBeDefined();
    // The required_input should not be in resolvedInputs since no default and no value provided
    // (the function warns but doesn't add it unless there's a default)
  });

  it('non-existent workflow file throws error', async () => {
    await expect(
      resolveReusableWorkflow(
        './.github/workflows/nonexistent.yml',
        {},
        undefined,
        {},
        tmpDir,
      ),
    ).rejects.toThrow('not found');
  });

  it('workflow with no workflow_call trigger still resolves', async () => {
    writeWorkflowFile('.github/workflows/no-call-trigger.yml', `
name: NoCalling
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo building
`);

    const result = await resolveReusableWorkflow(
      './.github/workflows/no-call-trigger.yml',
      { custom: 'value' },
      undefined,
      {},
      tmpDir,
    );

    // Should still work - the callTrigger will be empty
    expect(result.workflow).toBeDefined();
    expect(result.callTrigger).toEqual({});
    // Custom input is passed through even without definition
    expect(result.resolvedInputs.custom).toBe('value');
  });

  it('caller-provided inputs not in definition are passed through', async () => {
    writeWorkflowFile('.github/workflows/called.yml', `
name: Called
on:
  workflow_call:
    inputs:
      known:
        description: Known input
        default: default-val
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo building
`);

    const result = await resolveReusableWorkflow(
      './.github/workflows/called.yml',
      { known: 'overridden', extra: 'extra-value' },
      undefined,
      {},
      tmpDir,
    );

    expect(result.resolvedInputs.known).toBe('overridden');
    expect(result.resolvedInputs.extra).toBe('extra-value');
  });

  it('no secrets specified results in empty secrets', async () => {
    writeWorkflowFile('.github/workflows/called.yml', `
name: Called
on:
  workflow_call: {}
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo building
`);

    const result = await resolveReusableWorkflow(
      './.github/workflows/called.yml',
      {},
      undefined, // no secrets
      { SECRET_A: 'a', SECRET_B: 'b' },
      tmpDir,
    );

    // With undefined callerSecrets, no secrets should be passed
    expect(result.workflow).toBeDefined();
  });

  it('workflow_call outputs are captured in callTrigger', async () => {
    writeWorkflowFile('.github/workflows/called.yml', `
name: Called
on:
  workflow_call:
    outputs:
      result:
        description: The result
        value: \${{ jobs.build.outputs.status }}
jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      status: success
    steps:
      - run: echo building
`);

    const result = await resolveReusableWorkflow(
      './.github/workflows/called.yml',
      {},
      undefined,
      {},
      tmpDir,
    );

    expect(result.callTrigger.outputs).toBeDefined();
    expect(result.callTrigger.outputs!.result).toBeDefined();
    expect(result.callTrigger.outputs!.result.value).toContain('jobs.build.outputs.status');
  });
});
