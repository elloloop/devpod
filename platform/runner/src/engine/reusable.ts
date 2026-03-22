import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as os from 'node:os';
import {
  WorkflowFile,
  WorkflowCallTrigger,
  JobDefinition,
} from '../types.js';
import { parseWorkflowFile } from './parser.js';

/**
 * Parsed reference for a remote reusable workflow.
 */
interface RemoteWorkflowRef {
  owner: string;
  repo: string;
  ref: string;
  workflowPath: string; // e.g., '.github/workflows/shared.yml'
}

/**
 * Result of resolving a reusable workflow call.
 */
export interface ResolvedReusableWorkflow {
  /** The parsed workflow file for the called workflow. */
  workflow: WorkflowFile;
  /** The workflow_call trigger definition (inputs, secrets, outputs). */
  callTrigger: WorkflowCallTrigger;
  /** The resolved jobs from the called workflow, with inputs/secrets merged. */
  jobs: Record<string, JobDefinition>;
  /** Resolved input values (provided with defaults applied). */
  resolvedInputs: Record<string, string>;
}

/**
 * Resolve and prepare a reusable workflow call for execution.
 *
 * Supports:
 * - Local: uses: ./.github/workflows/tests.yml
 * - Remote: uses: org/repo/.github/workflows/shared.yml@ref
 *
 * Validates inputs against the workflow_call trigger definition,
 * applies defaults, and resolves secrets.
 */
export async function resolveReusableWorkflow(
  uses: string,
  callerWith: Record<string, string> | undefined,
  callerSecrets: Record<string, string> | 'inherit' | undefined,
  currentSecrets: Record<string, string>,
  workspacePath: string,
): Promise<ResolvedReusableWorkflow> {
  let workflow: WorkflowFile;

  if (isLocalWorkflowRef(uses)) {
    workflow = resolveLocalWorkflow(uses, workspacePath);
  } else {
    workflow = await resolveRemoteWorkflow(uses);
  }

  // Extract the workflow_call trigger definition
  const callTrigger = extractWorkflowCallTrigger(workflow);

  // Resolve inputs: merge provided values with defaults
  const resolvedInputs = resolveInputs(callerWith || {}, callTrigger);

  // Resolve secrets
  const resolvedSecrets = resolveSecrets(callerSecrets, currentSecrets, callTrigger);

  // The called workflow's jobs are returned as-is; the executor will run them
  // with the resolved inputs and secrets injected into the expression context.
  return {
    workflow,
    callTrigger,
    jobs: workflow.jobs,
    resolvedInputs,
  };
}

/**
 * Check if a `uses` reference points to a local workflow file.
 */
function isLocalWorkflowRef(uses: string): boolean {
  return uses.startsWith('./') || uses.startsWith('../');
}

/**
 * Resolve a local workflow reference (e.g., ./.github/workflows/tests.yml).
 */
function resolveLocalWorkflow(uses: string, workspacePath: string): WorkflowFile {
  const filePath = path.resolve(workspacePath, uses);

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Reusable workflow not found: '${uses}' (resolved to ${filePath})`
    );
  }

  return parseWorkflowFile(filePath);
}

/**
 * Parse a remote workflow reference like 'org/repo/.github/workflows/shared.yml@main'.
 */
function parseRemoteRef(uses: string): RemoteWorkflowRef {
  const atIdx = uses.lastIndexOf('@');
  if (atIdx === -1) {
    throw new Error(
      `Invalid remote workflow reference: '${uses}'. Expected format: owner/repo/path/to/workflow.yml@ref`
    );
  }

  const pathPart = uses.slice(0, atIdx);
  const ref = uses.slice(atIdx + 1);

  if (!ref || !pathPart) {
    throw new Error(
      `Invalid remote workflow reference: '${uses}'. Missing ref or path.`
    );
  }

  const segments = pathPart.split('/');
  if (segments.length < 3) {
    throw new Error(
      `Invalid remote workflow reference: '${uses}'. Expected at least owner/repo/path.`
    );
  }

  const owner = segments[0];
  const repo = segments[1];
  const workflowPath = segments.slice(2).join('/');

  return { owner, repo, ref, workflowPath };
}

/**
 * Cache directory for downloaded reusable workflows.
 */
function getWorkflowCacheDir(): string {
  return (
    process.env.RUNNER_WORKFLOW_CACHE ||
    path.join(os.homedir(), '.local', 'share', 'local-runner', 'workflow-cache')
  );
}

/**
 * Resolve a remote workflow reference by downloading the repo from GitHub.
 */
async function resolveRemoteWorkflow(uses: string): Promise<WorkflowFile> {
  const parsed = parseRemoteRef(uses);
  const { owner, repo, ref, workflowPath } = parsed;

  const cacheBase = getWorkflowCacheDir();
  const repoCache = path.join(cacheBase, owner, repo, ref);

  // Check if we already have it cached
  const workflowFile = path.join(repoCache, workflowPath);
  if (fs.existsSync(workflowFile)) {
    console.log(`Using cached reusable workflow ${owner}/${repo}/${workflowPath}@${ref}`);
    return parseWorkflowFile(workflowFile);
  }

  // Download the repo
  console.log(`Downloading reusable workflow ${owner}/${repo}@${ref}...`);

  fs.mkdirSync(path.dirname(repoCache), { recursive: true });

  if (fs.existsSync(repoCache)) {
    fs.rmSync(repoCache, { recursive: true, force: true });
  }

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  let cloneUrl = `https://github.com/${owner}/${repo}.git`;
  if (token) {
    cloneUrl = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
  }

  try {
    execFileSync('git', [
      'clone',
      '--depth', '1',
      '--branch', ref,
      '--single-branch',
      cloneUrl,
      repoCache,
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
    });
  } catch {
    // Fallback: the ref might be a commit SHA
    if (fs.existsSync(repoCache)) {
      fs.rmSync(repoCache, { recursive: true, force: true });
    }

    try {
      execFileSync('git', [
        'clone',
        '--no-checkout',
        '--filter=blob:none',
        cloneUrl,
        repoCache,
      ], {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 120_000,
      });

      execFileSync('git', ['checkout', ref], {
        cwd: repoCache,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 30_000,
      });
    } catch (fallbackErr) {
      if (fs.existsSync(repoCache)) {
        try { fs.rmSync(repoCache, { recursive: true, force: true }); } catch { /* ignore */ }
      }

      const hint = token
        ? 'The repository may not exist or the token may lack access.'
        : 'If this is a private repository, set GITHUB_TOKEN or GH_TOKEN.';

      throw new Error(
        `Failed to download reusable workflow ${owner}/${repo}@${ref}: ` +
        `${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}. ${hint}`
      );
    }
  }

  // Remove .git directory to save space
  const dotGit = path.join(repoCache, '.git');
  if (fs.existsSync(dotGit)) {
    try { fs.rmSync(dotGit, { recursive: true, force: true }); } catch { /* ignore */ }
  }

  if (!fs.existsSync(workflowFile)) {
    throw new Error(
      `Reusable workflow file '${workflowPath}' not found in ${owner}/${repo}@${ref}`
    );
  }

  console.log(`Cached reusable workflow ${owner}/${repo}@${ref} at ${repoCache}`);
  return parseWorkflowFile(workflowFile);
}

/**
 * Extract the workflow_call trigger definition from a parsed workflow.
 * If the workflow has no workflow_call trigger, returns an empty definition.
 */
function extractWorkflowCallTrigger(workflow: WorkflowFile): WorkflowCallTrigger {
  const on = workflow.on;

  if (typeof on === 'object' && !Array.isArray(on)) {
    const callTrigger = on.workflow_call;
    if (callTrigger && typeof callTrigger === 'object') {
      return callTrigger as WorkflowCallTrigger;
    }
  }

  // No workflow_call trigger found; return empty definition
  // (the workflow may still work, it just has no declared inputs/secrets/outputs)
  return {};
}

/**
 * Resolve input values by merging caller-provided values with defaults
 * from the workflow_call trigger definition.
 */
function resolveInputs(
  callerWith: Record<string, string>,
  callTrigger: WorkflowCallTrigger,
): Record<string, string> {
  const resolved: Record<string, string> = {};
  const inputDefs = callTrigger.inputs || {};

  // Apply defaults from the trigger definition
  for (const [name, def] of Object.entries(inputDefs)) {
    if (name in callerWith) {
      resolved[name] = callerWith[name];
    } else if (def.default !== undefined) {
      resolved[name] = def.default;
    } else if (def.required) {
      console.warn(`Required input '${name}' not provided for reusable workflow call`);
    }
  }

  // Also pass through any caller-provided inputs that aren't in the definition
  // (GitHub Actions silently ignores these, but we pass them for flexibility)
  for (const [name, value] of Object.entries(callerWith)) {
    if (!(name in resolved)) {
      resolved[name] = value;
    }
  }

  return resolved;
}

/**
 * Resolve secrets for the reusable workflow call.
 * - 'inherit': pass all current secrets
 * - explicit mapping: pass only the mapped secrets
 * - undefined: pass no secrets
 */
function resolveSecrets(
  callerSecrets: Record<string, string> | 'inherit' | undefined,
  currentSecrets: Record<string, string>,
  _callTrigger: WorkflowCallTrigger,
): Record<string, string> {
  if (callerSecrets === 'inherit') {
    return { ...currentSecrets };
  }

  if (callerSecrets && typeof callerSecrets === 'object') {
    // Explicit mapping: the values may be expression references that have already
    // been resolved by the expression evaluator, or literal secret names.
    // For now, return the caller-provided values as-is.
    return { ...callerSecrets };
  }

  // No secrets specified — pass nothing (GitHub Actions behavior)
  return {};
}
