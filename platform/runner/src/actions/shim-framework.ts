/**
 * Framework for declaring language/tool setup shims as structured data
 * instead of raw bash-in-template-strings.
 *
 * Each ShimDefinition describes a tool detection + setup sequence that gets
 * compiled into a composite GitHub Action YAML.
 */

// ── Types ──

/**
 * A single strategy for locating a tool on the system.
 * Strategies are tried in order; the first one that succeeds wins.
 */
export interface ToolDetectionStrategy {
  /** Human-readable name for logging (e.g., 'Homebrew', 'SDKMAN', 'PATH') */
  name: string;
  /**
   * Shell snippet that should output the tool path (or a success indicator)
   * and exit 0 on success, non-zero on failure.
   * Available variables: all INPUT_* vars, GITHUB_WORKSPACE, GITHUB_ENV, etc.
   */
  detect: string;
  /**
   * Shell snippet that sets TOOL_VERSION after a successful detect.
   * Receives TOOL_PATH from the detect step.
   * If omitted, TOOL_VERSION defaults to "unknown".
   */
  version?: string;
  /**
   * Optional shell snippet to run immediately after a successful detect.
   * Use this for strategy-specific setup (e.g., updating PATH from a found binary).
   * Receives TOOL_PATH and TOOL_VERSION.
   */
  postDetect?: string;
}

/**
 * Full definition of a language/tool setup shim.
 * Self-documenting: someone can understand what it does without reading bash.
 */
export interface ShimDefinition {
  /** Display name (e.g., 'Setup Java (local shim)') */
  name: string;
  /** Short description */
  description: string;
  /** Input definitions for the composite action */
  inputs: Record<string, { description: string; default?: string; required?: boolean }>;
  /** Output definitions for the composite action */
  outputs: Record<string, { description: string }>;
  /**
   * Ordered list of detection strategies — first success wins.
   * The detect script should set TOOL_FOUND to a truthy label on success.
   */
  detect: ToolDetectionStrategy[];
  /**
   * Shell snippet to run after a tool has been successfully detected.
   * Receives TOOL_PATH, TOOL_VERSION, TOOL_FOUND, and all INPUT_* variables.
   * Use this for setting outputs, updating GITHUB_ENV/GITHUB_PATH, etc.
   */
  setup?: string;
  /** Error message shown (via ::error::) when no strategy finds the tool */
  notFoundMessage: string;
  /**
   * If true, the shim does not exit 1 on failure — it warns and continues.
   * Used by tools like Gradle where absence is non-fatal.
   */
  softFail?: boolean;
  /**
   * If provided, these additional composite action steps are appended
   * after the main detect+setup step. Used for multi-step shims
   * (e.g., Ruby's bundler install step).
   */
  additionalSteps?: string;
}

// ── YAML generation helpers ──

/**
 * Indent every line of a multi-line string by the given number of spaces.
 */
function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => (line.trim() ? pad + line : ''))
    .join('\n');
}

/**
 * Build the YAML `inputs:` block from a ShimDefinition.
 */
function buildInputsYaml(inputs: ShimDefinition['inputs']): string {
  const lines: string[] = ['inputs:'];
  for (const [key, def] of Object.entries(inputs)) {
    lines.push(`  ${key}:`);
    lines.push(`    description: '${def.description}'`);
    if (def.required) {
      lines.push(`    required: true`);
    }
    if (def.default !== undefined) {
      lines.push(`    default: '${def.default}'`);
    }
  }
  return lines.join('\n');
}

/**
 * Build the YAML `outputs:` block from a ShimDefinition.
 * Each output's value references `steps.setup.outputs.<name>`.
 */
function buildOutputsYaml(outputs: ShimDefinition['outputs']): string {
  if (Object.keys(outputs).length === 0) return '';
  const lines: string[] = ['outputs:'];
  for (const [key, def] of Object.entries(outputs)) {
    lines.push(`  ${key}:`);
    lines.push(`    description: '${def.description}'`);
    lines.push(`    value: \${{ steps.setup.outputs.${key} }}`);
  }
  return lines.join('\n');
}

/**
 * Build the bash detection cascade from an ordered list of strategies.
 */
function buildDetectionScript(strategies: ToolDetectionStrategy[]): string {
  const blocks: string[] = [
    'TOOL_PATH=""',
    'TOOL_VERSION=""',
    'TOOL_FOUND=""',
    '',
  ];

  for (let i = 0; i < strategies.length; i++) {
    const s = strategies[i];
    blocks.push(`# Strategy ${i + 1}: ${s.name}`);
    blocks.push('if [ -z "$TOOL_FOUND" ]; then');

    // The detect block is written inline — it should set TOOL_PATH and TOOL_FOUND
    const detectLines = s.detect.trim().split('\n');
    for (const line of detectLines) {
      blocks.push(`  ${line}`);
    }

    // Version extraction (optional)
    if (s.version) {
      blocks.push('  if [ -n "$TOOL_FOUND" ]; then');
      const versionLines = s.version.trim().split('\n');
      for (const line of versionLines) {
        blocks.push(`    ${line}`);
      }
      blocks.push('  fi');
    }

    // Post-detect hook (optional)
    if (s.postDetect) {
      blocks.push('  if [ -n "$TOOL_FOUND" ]; then');
      const postLines = s.postDetect.trim().split('\n');
      for (const line of postLines) {
        blocks.push(`    ${line}`);
      }
      blocks.push('  fi');
    }

    blocks.push('fi');
    blocks.push('');
  }

  return blocks.join('\n');
}

/**
 * Generate a complete composite action YAML string from a ShimDefinition.
 *
 * The generated action:
 *   1. Tries each detection strategy in order
 *   2. Fails (or warns) if the tool is not found
 *   3. Runs the setup script to set outputs and env
 *   4. Optionally runs additional steps (e.g., bundler install for Ruby)
 */
export function generateShimActionYml(def: ShimDefinition): string {
  // --- Header ---
  const header = [
    `name: '${def.name}'`,
    `description: '${def.description}'`,
  ].join('\n');

  // --- Inputs ---
  const inputsYaml = buildInputsYaml(def.inputs);

  // --- Outputs ---
  const outputsYaml = buildOutputsYaml(def.outputs);

  // --- Detection script ---
  const detectionScript = buildDetectionScript(def.detect);

  // --- Failure handling ---
  let failureBlock: string;
  if (def.softFail) {
    const msgLines = def.notFoundMessage.split('\n');
    failureBlock = [
      'if [ -z "$TOOL_FOUND" ]; then',
      ...msgLines.map((m) => `  echo "::warning::${m}"`),
      'fi',
    ].join('\n');
  } else {
    const msgLines = def.notFoundMessage.split('\n');
    failureBlock = [
      'if [ -z "$TOOL_FOUND" ]; then',
      ...msgLines.map((m) => `  echo "::error::${m}"`),
      '  exit 1',
      'fi',
    ].join('\n');
  }

  // --- Setup script ---
  const setupBlock = def.setup ? def.setup.trim() : '';

  // --- Combine the main run script ---
  const runScript = [detectionScript, failureBlock, '', setupBlock]
    .filter(Boolean)
    .join('\n');

  // --- Build the steps YAML ---
  // Indent the bash script by 8 spaces (under run: |)
  const indentedScript = indent(runScript, 8);

  let stepsYaml = `runs:
  using: 'composite'
  steps:
    - name: ${def.name.replace(/'/g, "''")}
      id: setup
      shell: bash
      run: |
${indentedScript}`;

  // --- Additional steps (optional) ---
  if (def.additionalSteps) {
    stepsYaml += '\n' + def.additionalSteps;
  }

  // --- Assemble the full YAML ---
  const parts = [header, inputsYaml];
  if (outputsYaml) parts.push(outputsYaml);
  parts.push(stepsYaml);

  return parts.join('\n');
}
