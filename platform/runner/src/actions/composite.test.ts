import { describe, it, expect, vi } from 'vitest';
import { resolveActionInputs, getCompositeSteps, resolveCompositeOutputs } from './composite.js';
import { ActionDefinition, ExpressionContext } from '../types.js';

function makeCtx(overrides: Partial<ExpressionContext> = {}): ExpressionContext {
  return {
    github: {},
    env: {},
    inputs: {},
    steps: {},
    needs: {},
    jobs: {},
    runner: {},
    matrix: {},
    secrets: {},
    ...overrides,
  };
}

function makeAction(overrides: Partial<ActionDefinition> = {}): ActionDefinition {
  return {
    name: 'Test Action',
    runs: {
      using: 'composite',
      steps: [
        { run: 'echo hello', shell: 'bash' },
      ],
    },
    ...overrides,
  };
}

describe('resolveActionInputs', () => {
  it('with values override defaults', () => {
    const action = makeAction({
      inputs: {
        version: { description: 'Version', default: '1.0' },
        name: { description: 'Name', default: 'default-name' },
      },
    });
    const ctx = makeCtx();
    const result = resolveActionInputs(action, { version: '2.0' }, ctx);
    expect(result.version).toBe('2.0');
    expect(result.name).toBe('default-name');
  });

  it('defaults used when with is missing (undefined)', () => {
    const action = makeAction({
      inputs: {
        version: { description: 'Version', default: '1.0' },
        debug: { description: 'Debug', default: 'false' },
      },
    });
    const ctx = makeCtx();
    const result = resolveActionInputs(action, undefined, ctx);
    expect(result.version).toBe('1.0');
    expect(result.debug).toBe('false');
  });

  it('required input with missing value produces warning and empty string', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const action = makeAction({
      inputs: {
        token: { description: 'Token', required: true },
      },
    });
    const ctx = makeCtx();
    const result = resolveActionInputs(action, undefined, ctx);
    expect(result.token).toBe('');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Missing required input 'token'"));
    warnSpy.mockRestore();
  });

  it('extra with values not in action definition are passed through', () => {
    const action = makeAction({
      inputs: {
        version: { description: 'Version', default: '1.0' },
      },
    });
    const ctx = makeCtx();
    const result = resolveActionInputs(action, { version: '2.0', 'extra-param': 'extra-value' }, ctx);
    expect(result.version).toBe('2.0');
    expect(result['extra-param']).toBe('extra-value');
  });

  it('evaluates expressions in with values', () => {
    const action = makeAction({
      inputs: {
        greeting: { description: 'Greeting', default: 'hello' },
      },
    });
    const ctx = makeCtx({ env: { NAME: 'World' } });
    const result = resolveActionInputs(action, { greeting: 'Hello ${{ env.NAME }}' }, ctx);
    expect(result.greeting).toBe('Hello World');
  });

  it('evaluates expressions in default values', () => {
    const action = makeAction({
      inputs: {
        path: { description: 'Path', default: '${{ github.workspace }}/output' },
      },
    });
    const ctx = makeCtx({ github: { workspace: '/home/user/project' } });
    const result = resolveActionInputs(action, undefined, ctx);
    expect(result.path).toBe('/home/user/project/output');
  });

  it('action with no inputs returns empty object', () => {
    const action = makeAction({ inputs: undefined });
    const ctx = makeCtx();
    const result = resolveActionInputs(action, undefined, ctx);
    expect(result).toEqual({});
  });

  it('action with no inputs but with values passes them through', () => {
    const action = makeAction({ inputs: undefined });
    const ctx = makeCtx();
    const result = resolveActionInputs(action, { key: 'value' }, ctx);
    expect(result.key).toBe('value');
  });
});

describe('getCompositeSteps', () => {
  it('INPUT_* env vars are uppercased', () => {
    const action = makeAction({
      runs: {
        using: 'composite',
        steps: [{ run: 'echo $INPUT_VERSION', shell: 'bash' }],
      },
    });
    const result = getCompositeSteps(action, { version: '2.0', 'my-input': 'val' });
    expect(result.env['INPUT_VERSION']).toBe('2.0');
    expect(result.env['INPUT_MY-INPUT']).toBe('val');
  });

  it('returns the steps from the action', () => {
    const action = makeAction({
      runs: {
        using: 'composite',
        steps: [
          { run: 'echo step1', shell: 'bash' },
          { run: 'echo step2', shell: 'bash' },
        ],
      },
    });
    const result = getCompositeSteps(action, {});
    expect(result.steps).toHaveLength(2);
  });

  it('throws if action is not composite', () => {
    const action = makeAction({
      runs: {
        using: 'node20',
        main: 'index.js',
      },
    });
    expect(() => getCompositeSteps(action, {})).toThrow('not a composite action');
  });

  it('throws if composite action has no steps', () => {
    const action = makeAction({
      runs: {
        using: 'composite',
        // No steps
      },
    });
    expect(() => getCompositeSteps(action, {})).toThrow();
  });

  it('empty inputs produces empty env', () => {
    const action = makeAction({
      runs: {
        using: 'composite',
        steps: [{ run: 'echo hello', shell: 'bash' }],
      },
    });
    const result = getCompositeSteps(action, {});
    expect(result.env).toEqual({});
  });

  it('multiple inputs produce corresponding INPUT_ vars', () => {
    const action = makeAction({
      runs: {
        using: 'composite',
        steps: [{ run: 'echo test', shell: 'bash' }],
      },
    });
    const result = getCompositeSteps(action, {
      version: '1.0',
      cache: 'true',
      token: 'ghp_abc',
    });
    expect(result.env['INPUT_VERSION']).toBe('1.0');
    expect(result.env['INPUT_CACHE']).toBe('true');
    expect(result.env['INPUT_TOKEN']).toBe('ghp_abc');
  });
});

describe('resolveCompositeOutputs', () => {
  it('evaluates output value expressions against context', () => {
    const action = makeAction({
      outputs: {
        result: { description: 'Result', value: '${{ steps.build.outputs.result }}' },
        version: { description: 'Version', value: '${{ steps.setup.outputs.version }}' },
      },
    });
    const ctx = makeCtx({
      steps: {
        build: { outputs: { result: 'success' }, outcome: 'success', conclusion: 'success' },
        setup: { outputs: { version: '3.2.1' }, outcome: 'success', conclusion: 'success' },
      },
    });
    const outputs = resolveCompositeOutputs(action, ctx);
    expect(outputs.result).toBe('success');
    expect(outputs.version).toBe('3.2.1');
  });

  it('returns empty object when action has no outputs', () => {
    const action = makeAction({ outputs: undefined });
    const ctx = makeCtx();
    const outputs = resolveCompositeOutputs(action, ctx);
    expect(outputs).toEqual({});
  });

  it('returns empty string for missing step outputs', () => {
    const action = makeAction({
      outputs: {
        missing: { description: 'Missing', value: '${{ steps.nonexistent.outputs.val }}' },
      },
    });
    const ctx = makeCtx();
    const outputs = resolveCompositeOutputs(action, ctx);
    expect(outputs.missing).toBe('');
  });

  it('output without value expression is skipped', () => {
    const action = makeAction({
      outputs: {
        'no-value': { description: 'No value' },
      },
    });
    const ctx = makeCtx();
    const outputs = resolveCompositeOutputs(action, ctx);
    expect(outputs['no-value']).toBeUndefined();
  });

  it('multiple outputs are resolved independently', () => {
    const action = makeAction({
      outputs: {
        a: { description: 'A', value: '${{ steps.s1.outputs.x }}' },
        b: { description: 'B', value: '${{ steps.s2.outputs.y }}' },
      },
    });
    const ctx = makeCtx({
      steps: {
        s1: { outputs: { x: 'val-a' }, outcome: 'success', conclusion: 'success' },
        s2: { outputs: { y: 'val-b' }, outcome: 'success', conclusion: 'success' },
      },
    });
    const outputs = resolveCompositeOutputs(action, ctx);
    expect(outputs.a).toBe('val-a');
    expect(outputs.b).toBe('val-b');
  });
});
