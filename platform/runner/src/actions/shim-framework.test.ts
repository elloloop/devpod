import { describe, it, expect } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { generateShimActionYml, ShimDefinition } from './shim-framework.js';

function makeMinimalShim(overrides: Partial<ShimDefinition> = {}): ShimDefinition {
  return {
    name: 'Test Tool (local shim)',
    description: 'Local runner shim for test tool',
    inputs: {
      version: { description: 'Tool version', default: 'latest' },
    },
    outputs: {
      'tool-version': { description: 'Installed tool version' },
    },
    detect: [
      {
        name: 'system',
        detect: 'if command -v testtool &>/dev/null; then\n  TOOL_FOUND="system"\nfi',
      },
    ],
    notFoundMessage: 'Test tool not found. Install it.',
    ...overrides,
  };
}

describe('generateShimActionYml', () => {
  it('produces valid YAML (can be parsed back)', () => {
    const def = makeMinimalShim();
    const yml = generateShimActionYml(def);
    const parsed = parseYaml(yml);
    expect(parsed).not.toBeNull();
    expect(typeof parsed).toBe('object');
  });

  it('generated YAML has correct name and description', () => {
    const def = makeMinimalShim();
    const yml = generateShimActionYml(def);
    const parsed = parseYaml(yml) as Record<string, unknown>;
    expect(parsed.name).toBe('Test Tool (local shim)');
    expect(parsed.description).toBe('Local runner shim for test tool');
  });

  it('generated YAML has correct inputs section', () => {
    const def = makeMinimalShim({
      inputs: {
        version: { description: 'Tool version', default: 'latest' },
        cache: { description: 'Enable caching', default: 'false' },
        token: { description: 'Auth token', required: true },
      },
    });
    const yml = generateShimActionYml(def);
    const parsed = parseYaml(yml) as Record<string, unknown>;
    const inputs = parsed.inputs as Record<string, unknown>;

    expect(inputs.version).toBeDefined();
    expect(inputs.cache).toBeDefined();
    expect(inputs.token).toBeDefined();

    const versionInput = inputs.version as Record<string, unknown>;
    expect(versionInput.description).toBe('Tool version');
    expect(versionInput.default).toBe('latest');

    const tokenInput = inputs.token as Record<string, unknown>;
    expect(tokenInput.required).toBe(true);
  });

  it('generated YAML has correct outputs section', () => {
    const def = makeMinimalShim({
      outputs: {
        'tool-version': { description: 'Installed tool version' },
        'tool-path': { description: 'Path to tool binary' },
      },
    });
    const yml = generateShimActionYml(def);
    const parsed = parseYaml(yml) as Record<string, unknown>;
    const outputs = parsed.outputs as Record<string, unknown>;

    expect(outputs['tool-version']).toBeDefined();
    expect(outputs['tool-path']).toBeDefined();

    const tvOutput = outputs['tool-version'] as Record<string, unknown>;
    expect(tvOutput.description).toBe('Installed tool version');
    // Value should reference steps.setup.outputs
    expect(tvOutput.value).toContain('steps.setup.outputs.tool-version');
  });

  it('detection strategies appear in order', () => {
    const def = makeMinimalShim({
      detect: [
        { name: 'homebrew', detect: 'echo "checking homebrew"' },
        { name: 'apt', detect: 'echo "checking apt"' },
        { name: 'system', detect: 'echo "checking system"' },
      ],
    });
    const yml = generateShimActionYml(def);

    // Strategies should appear in order in the generated script
    const homebrewIdx = yml.indexOf('Strategy 1: homebrew');
    const aptIdx = yml.indexOf('Strategy 2: apt');
    const systemIdx = yml.indexOf('Strategy 3: system');

    expect(homebrewIdx).toBeGreaterThan(-1);
    expect(aptIdx).toBeGreaterThan(-1);
    expect(systemIdx).toBeGreaterThan(-1);
    expect(homebrewIdx).toBeLessThan(aptIdx);
    expect(aptIdx).toBeLessThan(systemIdx);
  });

  it('setup script is included in the generated YAML', () => {
    const def = makeMinimalShim({
      setup: 'echo "tool-version=$TOOL_VERSION" >> $GITHUB_OUTPUT\necho "Using tool"',
    });
    const yml = generateShimActionYml(def);
    expect(yml).toContain('tool-version=$TOOL_VERSION');
    expect(yml).toContain('Using tool');
  });

  it('notFoundMessage appears in error path', () => {
    const def = makeMinimalShim({
      notFoundMessage: 'Custom tool not found. Install with: brew install custom-tool',
    });
    const yml = generateShimActionYml(def);
    expect(yml).toContain('Custom tool not found');
    expect(yml).toContain('brew install custom-tool');
    expect(yml).toContain('::error::');
  });

  it('soft-fail mode produces warning instead of error', () => {
    const def = makeMinimalShim({
      softFail: true,
      notFoundMessage: 'Optional tool not found.',
    });
    const yml = generateShimActionYml(def);
    expect(yml).toContain('::warning::');
    // Should NOT contain exit 1
    // Check the failure block specifically
    const failureBlockStart = yml.indexOf('if [ -z "$TOOL_FOUND" ]; then');
    const failureBlockEnd = yml.indexOf('fi', failureBlockStart);
    const failureBlock = yml.slice(failureBlockStart, failureBlockEnd + 2);
    expect(failureBlock).not.toContain('exit 1');
  });

  it('non-soft-fail mode has exit 1', () => {
    const def = makeMinimalShim({
      softFail: false,
      notFoundMessage: 'Required tool not found.',
    });
    const yml = generateShimActionYml(def);
    expect(yml).toContain('::error::');
    expect(yml).toContain('exit 1');
  });

  it('multiple detection strategies generate cascading if blocks', () => {
    const def = makeMinimalShim({
      detect: [
        { name: 'first', detect: 'echo "check first"' },
        { name: 'second', detect: 'echo "check second"' },
      ],
    });
    const yml = generateShimActionYml(def);
    // Each strategy should be wrapped in: if [ -z "$TOOL_FOUND" ]; then ... fi
    // Plus the failure block also uses the same pattern, so total = strategies + 1
    const matches = yml.match(/if \[ -z "\$TOOL_FOUND" \]; then/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(3); // 2 strategies + 1 failure block
  });

  it('additional steps are appended after main step', () => {
    const additionalSteps = `    - name: Additional Setup
      shell: bash
      run: echo "additional setup"`;

    const def = makeMinimalShim({
      additionalSteps,
    });
    const yml = generateShimActionYml(def);
    expect(yml).toContain('Additional Setup');
    expect(yml).toContain('additional setup');
    // The additional steps should come after the main step
    const mainStepIdx = yml.indexOf('id: setup');
    const additionalIdx = yml.indexOf('Additional Setup');
    expect(mainStepIdx).toBeGreaterThan(-1);
    expect(additionalIdx).toBeGreaterThan(mainStepIdx);
  });

  it('empty outputs produces no outputs section', () => {
    const def = makeMinimalShim({ outputs: {} });
    const yml = generateShimActionYml(def);
    const parsed = parseYaml(yml) as Record<string, unknown>;
    // outputs key should not be present
    expect(parsed.outputs).toBeUndefined();
  });

  it('detect strategy with version extraction', () => {
    const def = makeMinimalShim({
      detect: [
        {
          name: 'system',
          detect: 'TOOL_FOUND="system"',
          version: 'TOOL_VERSION=$(testtool --version)',
        },
      ],
    });
    const yml = generateShimActionYml(def);
    expect(yml).toContain('TOOL_VERSION=$(testtool --version)');
  });

  it('detect strategy with postDetect hook', () => {
    const def = makeMinimalShim({
      detect: [
        {
          name: 'system',
          detect: 'TOOL_FOUND="system"',
          postDetect: 'echo "$TOOL_PATH/bin" >> $GITHUB_PATH',
        },
      ],
    });
    const yml = generateShimActionYml(def);
    expect(yml).toContain('echo "$TOOL_PATH/bin" >> $GITHUB_PATH');
  });

  it('composite action uses bash shell', () => {
    const def = makeMinimalShim();
    const yml = generateShimActionYml(def);
    const parsed = parseYaml(yml) as Record<string, unknown>;
    const runs = parsed.runs as Record<string, unknown>;
    expect(runs.using).toBe('composite');
    const steps = runs.steps as Array<Record<string, unknown>>;
    expect(steps[0].shell).toBe('bash');
  });
});
