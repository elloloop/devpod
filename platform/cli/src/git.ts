import { execSync } from 'node:child_process';

// ---------------------------------------------------------------------------
// Error translation — convert git jargon into plain language
// ---------------------------------------------------------------------------

function translateError(message: string): string {
  return message
    .replace(/fatal: not a git repository[^]*/i, 'Not inside a project directory.')
    .replace(/fatal: ambiguous argument '([^']+)'/i, 'Could not find reference "$1".')
    .replace(/error: pathspec '([^']+)' did not match/i, 'File or branch "$1" does not exist.')
    .replace(/error: Your local changes to the following files would be overwritten/i, 'You have unsaved changes that would be lost.')
    .replace(/CONFLICT \(content\): Merge conflict in (.+)/g, 'Conflicting changes in $1.')
    .replace(/error: could not apply .+/i, 'Could not apply the changes — there are conflicting edits.')
    .replace(/fatal: refusing to merge unrelated histories/i, 'These branches have no common history.')
    .replace(/fatal: '([^']+)' does not appear to be a git repository/i, 'Could not connect to remote "$1".')
    .replace(/fatal: Couldn't find remote ref/i, 'The remote branch does not exist.')
    .replace(/fatal: The current branch .+ has no upstream branch/i, 'This branch has not been pushed yet.')
    .replace(/error: failed to push some refs/i, 'Could not push — the remote has newer changes.')
    .replace(/fatal: bad object/i, 'Could not find that commit.')
    .replace(/Already on '([^']+)'/i, 'Already on branch "$1".')
    .replace(/HEAD detached at/i, 'Not on any branch.')
    .replace(/nothing to commit, working tree clean/i, 'No changes to save.')
    .replace(/\bHEAD\b/g, 'current commit')
    .replace(/\bstaging area\b/gi, 'staged changes')
    .replace(/\bworking tree\b/gi, 'project directory')
    .replace(/\bindex\b(?=\s)/g, 'staged changes');
}

// ---------------------------------------------------------------------------
// Core executor
// ---------------------------------------------------------------------------

export function git(args: string, cwd?: string): string {
  try {
    return execSync('git ' + args, {
      cwd: cwd || process.cwd(),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (err: unknown) {
    const error = err as { stderr?: string; message?: string };
    const raw = error.stderr || error.message || 'Unknown git error';
    throw new Error(translateError(raw.trim()));
  }
}

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------

export function clone(url: string, dir: string): void {
  git(`clone ${url} ${dir}`);
}

export function getCurrentBranch(cwd?: string): string {
  return git('rev-parse --abbrev-ref HEAD', cwd);
}

export function getDefaultBranch(cwd?: string): string {
  // Try to read from remote origin HEAD
  try {
    const remote = git('remote show origin', cwd);
    const match = remote.match(/HEAD branch:\s*(\S+)/);
    if (match) return match[1]!;
  } catch {
    // fallback below
  }
  // Check if main exists locally
  try {
    git('rev-parse --verify main', cwd);
    return 'main';
  } catch {
    return 'master';
  }
}

export function isClean(cwd?: string): boolean {
  const status = git('status --porcelain', cwd);
  return status.length === 0;
}

export function getRepoRoot(cwd?: string): string {
  return git('rev-parse --show-toplevel', cwd);
}

/** Alias for backward compatibility. */
export const repoRoot = getRepoRoot;

export function getRemoteUrl(cwd?: string): string {
  return git('remote get-url origin', cwd);
}

export function getRepoName(cwd?: string): string {
  const url = getRemoteUrl(cwd);
  // Handle SSH: git@github.com:owner/repo.git
  const sshMatch = url.match(/:([^/]+\/[^/]+?)(?:\.git)?$/);
  if (sshMatch) return sshMatch[1]!;
  // Handle HTTPS: https://github.com/owner/repo.git
  const httpsMatch = url.match(/\/([^/]+\/[^/]+?)(?:\.git)?$/);
  if (httpsMatch) return httpsMatch[1]!;
  return url;
}

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------

export function createBranch(name: string, from: string, cwd?: string): void {
  git(`checkout -b ${name} ${from}`, cwd);
}

export function switchBranch(name: string, cwd?: string): void {
  git(`checkout ${name}`, cwd);
}

export function deleteBranch(name: string, cwd?: string): void {
  git(`branch -D ${name}`, cwd);
}

export function branchExists(name: string, cwd?: string): boolean {
  try {
    git(`rev-parse --verify ${name}`, cwd);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Changes
// ---------------------------------------------------------------------------

export function getChangedFiles(cwd?: string): { path: string; status: 'added' | 'modified' | 'deleted' }[] {
  const output = git('status --porcelain', cwd);
  if (!output) return [];

  return output.split('\n').filter(Boolean).map((line) => {
    const code = line.substring(0, 2).trim();
    const filePath = line.substring(3).trim();
    let status: 'added' | 'modified' | 'deleted';
    switch (code) {
      case 'A':
      case '??':
        status = 'added';
        break;
      case 'D':
        status = 'deleted';
        break;
      default:
        status = 'modified';
        break;
    }
    return { path: filePath, status };
  });
}

export function getDiff(cwd?: string): string {
  // Show both staged and unstaged changes
  const parts: string[] = [];
  try { const s = git('diff --cached', cwd); if (s) parts.push(s); } catch { /* empty */ }
  try { const u = git('diff', cwd); if (u) parts.push(u); } catch { /* empty */ }
  return parts.join('\n');
}

export function getDiffStats(cwd?: string): { additions: number; deletions: number; files: number } {
  const diff = getDiff(cwd);
  if (!diff) return { additions: 0, deletions: 0, files: 0 };

  let additions = 0;
  let deletions = 0;
  const filesSet = new Set<string>();

  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ b/')) {
      filesSet.add(line.substring(6));
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      additions++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      deletions++;
    }
  }

  return { additions, deletions, files: filesSet.size };
}

export function stageAll(cwd?: string): void {
  git('add -A', cwd);
}

export function commit(message: string, cwd?: string): string {
  git(`commit -m ${JSON.stringify(message)}`, cwd);
  return getHeadSha(cwd);
}

export function amend(message?: string, cwd?: string): string {
  if (message) {
    git(`commit --amend -m ${JSON.stringify(message)}`, cwd);
  } else {
    git('commit --amend --no-edit', cwd);
  }
  return getHeadSha(cwd);
}

export function getCommitMessage(sha: string, cwd?: string): string {
  return git(`log -1 --format=%B ${sha}`, cwd);
}

export function getCommitDiff(sha: string, cwd?: string): string {
  return git(`show ${sha} --format=`, cwd);
}

// ---------------------------------------------------------------------------
// Sync / Rebase
// ---------------------------------------------------------------------------

export function fetchMain(cwd?: string): void {
  const defaultBranch = getDefaultBranch(cwd);
  git(`fetch origin ${defaultBranch}`, cwd);
}

export function rebaseOnto(branch: string, cwd?: string): { success: boolean; conflicts?: string[] } {
  try {
    git(`rebase ${branch}`, cwd);
    return { success: true };
  } catch (err: unknown) {
    const conflicts = extractConflictFiles(cwd);
    return { success: false, conflicts };
  }
}

export function rebaseContinue(cwd?: string): { success: boolean; conflicts?: string[] } {
  try {
    git('-c core.editor=true rebase --continue', cwd);
    return { success: true };
  } catch (err: unknown) {
    const conflicts = extractConflictFiles(cwd);
    return { success: false, conflicts };
  }
}

export function rebaseAbort(cwd?: string): void {
  git('rebase --abort', cwd);
}

export function pushForce(branch: string, cwd?: string): void {
  git(`push --force-with-lease origin ${branch}`, cwd);
}

export function cherryPickSquash(sha: string, cwd?: string): void {
  git(`cherry-pick --no-commit ${sha}`, cwd);
}

function extractConflictFiles(cwd?: string): string[] {
  try {
    const output = git('diff --name-only --diff-filter=U', cwd);
    return output.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

const LOG_SEP = '---DEVPOD_SEP---';

export function getLog(branch: string, since: string, cwd?: string): { sha: string; shortSha: string; message: string; date: string }[] {
  let output: string;
  try {
    output = git(`log ${branch} --since="${since}" --format=%H${LOG_SEP}%h${LOG_SEP}%s${LOG_SEP}%ci`, cwd);
  } catch {
    return [];
  }
  if (!output) return [];

  return output.split('\n').filter(Boolean).map((line) => {
    const parts = line.split(LOG_SEP);
    return {
      sha: parts[0] || '',
      shortSha: parts[1] || '',
      message: parts[2] || '',
      date: parts[3] || '',
    };
  });
}

export function getCommitsBetween(base: string, head: string, cwd?: string): { sha: string; shortSha: string; message: string }[] {
  let output: string;
  try {
    output = git(`log ${base}..${head} --format=%H${LOG_SEP}%h${LOG_SEP}%s`, cwd);
  } catch {
    return [];
  }
  if (!output) return [];

  return output.split('\n').filter(Boolean).map((line) => {
    const parts = line.split(LOG_SEP);
    return {
      sha: parts[0] || '',
      shortSha: parts[1] || '',
      message: parts[2] || '',
    };
  });
}

export function getHeadSha(cwd?: string): string {
  return git('rev-parse HEAD', cwd);
}

export function getReflogEntry(n: number, cwd?: string): string {
  return git(`reflog show HEAD@{${n}} --format=%H`, cwd);
}

// ---------------------------------------------------------------------------
// Worktree
// ---------------------------------------------------------------------------

export function isInsideWorktree(cwd?: string): boolean {
  try {
    const result = git('rev-parse --is-inside-work-tree', cwd);
    return result === 'true';
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Backward-compatibility aliases used by existing code
// ---------------------------------------------------------------------------

/** @deprecated Use getRepoRoot */
export function isGitRepo(cwd?: string): boolean {
  try {
    getRepoRoot(cwd);
    return true;
  } catch {
    return false;
  }
}
