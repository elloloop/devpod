import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ActionDefinition } from '../types.js';
import { resolveActionPath as resolveActionPathFromResolver } from './resolver.js';

/**
 * Load a local action definition from a directory containing action.yml or action.yaml.
 */
export function loadAction(actionPath: string): ActionDefinition {
  const ymlPath = path.join(actionPath, 'action.yml');
  const yamlPath = path.join(actionPath, 'action.yaml');

  let filePath: string;
  if (fs.existsSync(ymlPath)) {
    filePath = ymlPath;
  } else if (fs.existsSync(yamlPath)) {
    filePath = yamlPath;
  } else {
    throw new Error(`No action.yml or action.yaml found in ${actionPath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const raw = parseYaml(content) as Record<string, unknown>;

  if (!raw || typeof raw !== 'object') {
    throw new Error(`Invalid action file: ${filePath}`);
  }

  const runs = raw.runs as Record<string, unknown>;
  if (!runs) {
    throw new Error(`Action missing 'runs' key: ${filePath}`);
  }

  return {
    name: String(raw.name || path.basename(actionPath)),
    description: raw.description as string | undefined,
    inputs: normalizeActionInputs(raw.inputs),
    outputs: normalizeActionOutputs(raw.outputs),
    runs: {
      using: String(runs.using) as ActionDefinition['runs']['using'],
      steps: runs.steps as ActionDefinition['runs']['steps'],
      main: runs.main as string | undefined,
      pre: runs.pre as string | undefined,
      post: runs.post as string | undefined,
      'pre-if': runs['pre-if'] as string | undefined,
      'post-if': runs['post-if'] as string | undefined,
      image: runs.image as string | undefined,
      entrypoint: runs.entrypoint as string | undefined,
      args: normalizeArgs(runs.args),
      env: normalizeEnv(runs.env),
    },
  };
}

/**
 * Resolve a `uses:` reference to an absolute path.
 *
 * Supports:
 *   - Local: `./path/to/action` → resolves relative to workspace
 *   - Marketplace: `actions/checkout@v4` → downloads from GitHub, caches locally
 *   - Docker: `docker://image:tag` → returns the docker reference string
 */
export async function resolveActionPath(uses: string, workspacePath: string): Promise<string | null> {
  return resolveActionPathFromResolver(uses, workspacePath);
}

function normalizeActionInputs(inputs: unknown): Record<string, { description?: string; required?: boolean; default?: string }> | undefined {
  if (!inputs || typeof inputs !== 'object') return undefined;
  const result: Record<string, { description?: string; required?: boolean; default?: string }> = {};
  for (const [k, v] of Object.entries(inputs as Record<string, unknown>)) {
    const input = v as Record<string, unknown>;
    result[k] = {
      description: input.description as string | undefined,
      required: input.required as boolean | undefined,
      default: input.default !== undefined ? String(input.default) : undefined,
    };
  }
  return result;
}

function normalizeActionOutputs(outputs: unknown): Record<string, { description?: string; value?: string }> | undefined {
  if (!outputs || typeof outputs !== 'object') return undefined;
  const result: Record<string, { description?: string; value?: string }> = {};
  for (const [k, v] of Object.entries(outputs as Record<string, unknown>)) {
    const output = v as Record<string, unknown>;
    result[k] = {
      description: output.description as string | undefined,
      value: output.value as string | undefined,
    };
  }
  return result;
}

function normalizeArgs(args: unknown): string[] | undefined {
  if (!args) return undefined;
  if (Array.isArray(args)) return args.map(String);
  return undefined;
}

function normalizeEnv(env: unknown): Record<string, string> | undefined {
  if (!env || typeof env !== 'object') return undefined;
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(env as Record<string, unknown>)) {
    result[k] = String(v ?? '');
  }
  return result;
}
