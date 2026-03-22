import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const DEFAULT_SANDBOX_BASE = '/tmp/runner-sandboxes';

export interface SandboxOptions {
  workspacePath: string;
  runId: string;
  strategy?: 'worktree' | 'copy' | 'auto'; // default: 'auto'
  ref?: string; // git ref for worktree (default: HEAD)
  cleanNodeModules?: boolean; // default: false — if true, skip node_modules in copy
}

export interface Sandbox {
  path: string;           // The isolated workspace path
  strategy: string;       // Which strategy was used
  cleanup: () => Promise<void>;  // Call to remove the sandbox
}

/**
 * Return the base directory for sandbox workspaces.
 * Honors `$RUNNER_SANDBOX_DIR` or falls back to `/tmp/runner-sandboxes`.
 */
function sandboxBase(): string {
  return process.env.RUNNER_SANDBOX_DIR || DEFAULT_SANDBOX_BASE;
}

/**
 * Check whether a path is inside a git repository.
 */
function isGitRepo(dir: string): boolean {
  try {
    execSync('git rev-parse --git-dir', { cwd: dir, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Create an isolated workspace for a workflow run.
 *
 * Strategy (in order of preference when `auto`):
 *
 * 1. Git worktree (fastest for git repos):
 *    - `git worktree add --detach /tmp/runner-sandboxes/{runId} HEAD`
 *    - Lightning fast: only creates a new working tree, shares .git objects
 *    - Perfectly isolated: changes don't affect the original workspace
 *    - Cleanup: `git worktree remove --force ...`
 *
 * 2. Copy-on-write clone (fast on macOS APFS):
 *    - `cp -c -R workspace /tmp/runner-sandboxes/{runId}`
 *    - Near-instant on APFS, falls back to regular copy on other FS
 *
 * 3. Regular copy (fallback):
 *    - `cp -R workspace /tmp/runner-sandboxes/{runId}`
 *    - Always works
 */
export async function createSandbox(opts: SandboxOptions): Promise<Sandbox> {
  const strategy = opts.strategy || 'auto';
  const base = sandboxBase();
  const sandboxPath = path.join(base, opts.runId);

  // Ensure the base directory exists
  fs.mkdirSync(base, { recursive: true });

  if (strategy === 'worktree' || strategy === 'auto') {
    if (isGitRepo(opts.workspacePath)) {
      try {
        return await createWorktreeSandbox(opts, sandboxPath);
      } catch (err) {
        if (strategy === 'worktree') {
          throw new Error(`Failed to create git worktree sandbox: ${err instanceof Error ? err.message : String(err)}`);
        }
        // auto: fall through to copy strategies
        console.warn(`Worktree sandbox failed, falling back to copy: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else if (strategy === 'worktree') {
      throw new Error('Cannot use worktree strategy: workspace is not a git repository');
    }
  }

  // Copy strategies (copy-on-write on macOS, regular copy otherwise)
  if (strategy === 'copy' || strategy === 'auto') {
    return await createCopySandbox(opts, sandboxPath);
  }

  // Should not reach here, but just in case
  return await createCopySandbox(opts, sandboxPath);
}

/**
 * Create a sandbox using `git worktree add`.
 */
async function createWorktreeSandbox(opts: SandboxOptions, sandboxPath: string): Promise<Sandbox> {
  const ref = opts.ref || 'HEAD';

  execSync(
    `git worktree add --detach ${JSON.stringify(sandboxPath)} ${ref}`,
    { cwd: opts.workspacePath, stdio: 'pipe' },
  );

  return {
    path: sandboxPath,
    strategy: 'worktree',
    cleanup: async () => {
      try {
        execSync(
          `git worktree remove --force ${JSON.stringify(sandboxPath)}`,
          { cwd: opts.workspacePath, stdio: 'pipe' },
        );
      } catch {
        // If worktree remove fails, try manual cleanup
        try {
          fs.rmSync(sandboxPath, { recursive: true, force: true });
          execSync('git worktree prune', { cwd: opts.workspacePath, stdio: 'pipe' });
        } catch {
          // Best effort
        }
      }
    },
  };
}

/**
 * Create a sandbox by copying the workspace.
 * On macOS, uses `cp -c` for APFS copy-on-write (near-instant).
 * Falls back to regular `cp -R` on other platforms.
 */
async function createCopySandbox(opts: SandboxOptions, sandboxPath: string): Promise<Sandbox> {
  const isMac = process.platform === 'darwin';

  if (isMac) {
    try {
      // APFS copy-on-write clone: near-instant, no extra disk space until modified
      execSync(
        `cp -c -R ${JSON.stringify(opts.workspacePath)} ${JSON.stringify(sandboxPath)}`,
        { stdio: 'pipe' },
      );

      return {
        path: sandboxPath,
        strategy: 'copy-on-write',
        cleanup: async () => {
          try {
            fs.rmSync(sandboxPath, { recursive: true, force: true });
          } catch {
            // Best effort
          }
        },
      };
    } catch {
      // cp -c failed (non-APFS filesystem), fall through to regular copy
    }
  }

  // Regular copy — use rsync with exclusions for large regeneratable dirs
  const excludes = [
    '.git',
    'node_modules',
    '.next',
    'build',
    'dist',
    '.gradle',
    'Pods',
    '.dart_tool',
    '.pub-cache',
  ];

  const excludeArgs = excludes.map(e => `--exclude=${JSON.stringify(e)}`).join(' ');

  try {
    fs.mkdirSync(sandboxPath, { recursive: true });
    execSync(
      `rsync -a ${excludeArgs} ${JSON.stringify(opts.workspacePath + '/')} ${JSON.stringify(sandboxPath + '/')}`,
      { stdio: 'pipe' },
    );
  } catch {
    // rsync not available, fall back to cp -R
    // Remove any partial directory first
    try { fs.rmSync(sandboxPath, { recursive: true, force: true }); } catch { /* ignore */ }
    execSync(
      `cp -R ${JSON.stringify(opts.workspacePath)} ${JSON.stringify(sandboxPath)}`,
      { stdio: 'pipe' },
    );
  }

  return {
    path: sandboxPath,
    strategy: 'copy',
    cleanup: async () => {
      try {
        fs.rmSync(sandboxPath, { recursive: true, force: true });
      } catch {
        // Best effort
      }
    },
  };
}

/**
 * Clean up stale sandboxes from previous runs.
 * Removes sandbox directories older than `maxAgeMs` (default: 1 hour).
 * Also prunes orphaned git worktrees if `workspacePath` is a git repo.
 */
export async function cleanupStaleSandboxes(
  workspacePath: string,
  maxAgeMs: number = 60 * 60 * 1000,
): Promise<number> {
  const base = sandboxBase();
  let removed = 0;

  if (!fs.existsSync(base)) {
    // Nothing to clean up
    return removed;
  }

  const now = Date.now();

  try {
    const entries = fs.readdirSync(base, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const entryPath = path.join(base, entry.name);
      try {
        const stat = fs.statSync(entryPath);
        const ageMs = now - stat.mtimeMs;
        if (ageMs > maxAgeMs) {
          fs.rmSync(entryPath, { recursive: true, force: true });
          removed++;
        }
      } catch {
        // Skip entries we can't stat
      }
    }
  } catch {
    // Can't read the sandbox directory
  }

  // Prune orphaned git worktrees
  if (isGitRepo(workspacePath)) {
    try {
      execSync('git worktree prune', { cwd: workspacePath, stdio: 'pipe' });
    } catch {
      // Best effort
    }
  }

  return removed;
}
