import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  WorkflowFile,
  WorkflowInfo,
  WorkflowInput,
  WorkflowTrigger,
  JobDefinition,
} from '../types.js';

/**
 * Discover all workflow YAML files under .github/workflows/ in the given directory.
 */
export function discoverWorkflows(workspacePath: string): string[] {
  const workflowDir = path.join(workspacePath, '.github', 'workflows');
  if (!fs.existsSync(workflowDir)) return [];

  return fs.readdirSync(workflowDir)
    .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
    .map(f => path.join(workflowDir, f))
    .sort();
}

/**
 * Parse a single workflow YAML file into a strongly-typed WorkflowFile.
 */
export function parseWorkflowFile(filePath: string): WorkflowFile {
  const content = fs.readFileSync(filePath, 'utf-8');
  const raw = parseYaml(content) as Record<string, unknown>;

  if (!raw || typeof raw !== 'object') {
    throw new Error(`Invalid workflow file: ${filePath}`);
  }

  const workflow: WorkflowFile = {
    name: (raw.name as string) || path.basename(filePath, path.extname(filePath)),
    on: normalizeOn(raw.on as WorkflowTrigger | undefined),
    env: normalizeEnv(raw.env),
    jobs: normalizeJobs(raw.jobs as Record<string, unknown> | undefined),
  };

  return workflow;
}

/**
 * Parse a workflow file and return summary information.
 */
export function getWorkflowInfo(filePath: string): WorkflowInfo {
  const workflow = parseWorkflowFile(filePath);
  const fileName = path.basename(filePath);
  const triggers = extractTriggers(workflow.on);
  const jobs = Object.entries(workflow.jobs).map(([id, def]) => ({
    id,
    name: def.name || id,
    needs: normalizeNeeds(def.needs),
  }));

  let inputs: Record<string, WorkflowInput> | undefined;
  if (typeof workflow.on === 'object' && !Array.isArray(workflow.on) && workflow.on.workflow_dispatch?.inputs) {
    inputs = workflow.on.workflow_dispatch.inputs;
  }

  return {
    name: workflow.name || fileName,
    fileName,
    filePath,
    triggers,
    jobs,
    inputs,
  };
}

/**
 * List all workflows with their info.
 */
export function listWorkflows(workspacePath: string): WorkflowInfo[] {
  const files = discoverWorkflows(workspacePath);
  const infos: WorkflowInfo[] = [];

  for (const f of files) {
    try {
      infos.push(getWorkflowInfo(f));
    } catch (err) {
      console.error(`Failed to parse workflow ${f}:`, err);
    }
  }

  return infos;
}

/**
 * Find a workflow by name (matches filename without extension, or the name field).
 */
export function findWorkflow(workspacePath: string, nameOrFile: string): { filePath: string; workflow: WorkflowFile } | null {
  const files = discoverWorkflows(workspacePath);

  for (const f of files) {
    const baseName = path.basename(f, path.extname(f));
    if (baseName === nameOrFile || path.basename(f) === nameOrFile) {
      return { filePath: f, workflow: parseWorkflowFile(f) };
    }
  }

  // Try matching by workflow name
  for (const f of files) {
    try {
      const wf = parseWorkflowFile(f);
      if (wf.name === nameOrFile) {
        return { filePath: f, workflow: wf };
      }
    } catch {
      // skip
    }
  }

  return null;
}

// ── Internal helpers ──

function normalizeOn(on: WorkflowTrigger | undefined): WorkflowTrigger {
  if (!on) return { workflow_dispatch: {} };
  return on;
}

function normalizeEnv(env: unknown): Record<string, string> {
  if (!env || typeof env !== 'object') return {};
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(env as Record<string, unknown>)) {
    result[k] = String(v ?? '');
  }
  return result;
}

function normalizeJobs(jobs: Record<string, unknown> | undefined): Record<string, JobDefinition> {
  if (!jobs || typeof jobs !== 'object') return {};

  const result: Record<string, JobDefinition> = {};
  for (const [id, raw] of Object.entries(jobs)) {
    const job = raw as Record<string, unknown>;

    // A reusable workflow call has `uses` instead of `steps`
    if (job.uses) {
      result[id] = {
        name: (job.name as string) || undefined,
        uses: job.uses as string,
        with: normalizeWith(job.with),
        secrets: normalizeSecrets(job.secrets),
        needs: job.needs as string | string[] | undefined,
        if: job.if as string | undefined,
        // Reusable workflow calls have no steps
        steps: [],
        env: normalizeEnv(job.env),
      };
    } else {
      result[id] = {
        name: (job.name as string) || undefined,
        'runs-on': job['runs-on'] as string | undefined,
        needs: job.needs as string | string[] | undefined,
        if: job.if as string | undefined,
        env: normalizeEnv(job.env),
        defaults: normalizeDefaults(job.defaults),
        strategy: normalizeStrategy(job.strategy),
        steps: normalizeSteps(job.steps as unknown[]),
        outputs: normalizeOutputs(job.outputs),
        services: normalizeServices(job.services),
        'timeout-minutes': job['timeout-minutes'] as number | undefined,
        'working-directory': job['working-directory'] as string | undefined,
      };
    }
  }
  return result;
}

function normalizeSteps(steps: unknown[]): JobDefinition['steps'] {
  if (!Array.isArray(steps)) return [];
  return steps.map((raw, idx) => {
    const step = raw as Record<string, unknown>;
    return {
      id: step.id as string | undefined,
      name: (step.name as string) || undefined,
      run: step.run as string | undefined,
      uses: step.uses as string | undefined,
      with: normalizeWith(step.with),
      env: normalizeEnv(step.env),
      if: step.if as string | undefined,
      'working-directory': step['working-directory'] as string | undefined,
      shell: step.shell as string | undefined,
      'continue-on-error': step['continue-on-error'] as boolean | undefined,
      'timeout-minutes': step['timeout-minutes'] as number | undefined,
    };
  });
}

function normalizeWith(withBlock: unknown): Record<string, string> | undefined {
  if (!withBlock || typeof withBlock !== 'object') return undefined;
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(withBlock as Record<string, unknown>)) {
    result[k] = String(v ?? '');
  }
  return result;
}

function normalizeSecrets(secrets: unknown): Record<string, string> | 'inherit' | undefined {
  if (secrets === 'inherit') return 'inherit';
  if (!secrets || typeof secrets !== 'object') return undefined;
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(secrets as Record<string, unknown>)) {
    result[k] = String(v ?? '');
  }
  return result;
}

function normalizeOutputs(outputs: unknown): Record<string, string> | undefined {
  if (!outputs || typeof outputs !== 'object') return undefined;
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(outputs as Record<string, unknown>)) {
    if (typeof v === 'object' && v !== null && 'value' in (v as Record<string, unknown>)) {
      result[k] = String((v as Record<string, unknown>).value ?? '');
    } else {
      result[k] = String(v ?? '');
    }
  }
  return result;
}

function normalizeServices(services: unknown): Record<string, import('../types.js').ServiceDefinition> | undefined {
  if (!services || typeof services !== 'object') return undefined;
  const result: Record<string, import('../types.js').ServiceDefinition> = {};
  for (const [name, raw] of Object.entries(services as Record<string, unknown>)) {
    const svc = raw as Record<string, unknown>;
    result[name] = {
      image: String(svc.image ?? ''),
      ports: svc.ports as string[] | undefined,
      env: normalizeEnv(svc.env),
      volumes: svc.volumes as string[] | undefined,
      options: svc.options as string | undefined,
    };
  }
  return result;
}

function normalizeDefaults(defaults: unknown): import('../types.js').JobDefaults | undefined {
  if (!defaults || typeof defaults !== 'object') return undefined;
  const d = defaults as Record<string, unknown>;
  const result: import('../types.js').JobDefaults = {};
  if (d.run && typeof d.run === 'object') {
    const run = d.run as Record<string, unknown>;
    result.run = {
      'working-directory': run['working-directory'] as string | undefined,
      shell: run.shell as string | undefined,
    };
  }
  return result;
}

function normalizeStrategy(strategy: unknown): import('../types.js').JobDefinition['strategy'] {
  if (!strategy || typeof strategy !== 'object') return undefined;
  const s = strategy as Record<string, unknown>;
  if (!s.matrix || typeof s.matrix !== 'object') return undefined;

  const rawMatrix = s.matrix as Record<string, unknown>;
  const matrix: Record<string, unknown[]> & {
    include?: Record<string, unknown>[];
    exclude?: Record<string, unknown>[];
  } = {} as Record<string, unknown[]> & {
    include?: Record<string, unknown>[];
    exclude?: Record<string, unknown>[];
  };

  for (const [key, val] of Object.entries(rawMatrix)) {
    if (key === 'include') {
      if (Array.isArray(val)) {
        matrix.include = val as Record<string, unknown>[];
      }
    } else if (key === 'exclude') {
      if (Array.isArray(val)) {
        matrix.exclude = val as Record<string, unknown>[];
      }
    } else {
      // Ensure values are arrays
      matrix[key] = Array.isArray(val) ? val : [val];
    }
  }

  return {
    matrix,
    'fail-fast': typeof s['fail-fast'] === 'boolean' ? s['fail-fast'] : undefined,
    'max-parallel': typeof s['max-parallel'] === 'number' ? s['max-parallel'] : undefined,
  };
}

function normalizeNeeds(needs: unknown): string[] {
  if (!needs) return [];
  if (typeof needs === 'string') return [needs];
  if (Array.isArray(needs)) return needs.map(String);
  return [];
}

function extractTriggers(on: WorkflowTrigger): string[] {
  if (typeof on === 'string') return [on];
  if (Array.isArray(on)) return on;
  if (typeof on === 'object') return Object.keys(on);
  return [];
}
