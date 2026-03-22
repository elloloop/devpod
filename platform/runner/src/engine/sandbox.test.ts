import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';
import { createSandbox, cleanupStaleSandboxes } from './sandbox.js';

let tmpDir: string;
let sandboxBase: string;
const originalEnv = { ...process.env };

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sandbox-test-'));
  sandboxBase = fs.mkdtempSync(path.join(os.tmpdir(), 'sandbox-base-'));
  process.env.RUNNER_SANDBOX_DIR = sandboxBase;
});

afterEach(() => {
  // Restore env
  process.env.RUNNER_SANDBOX_DIR = originalEnv.RUNNER_SANDBOX_DIR;
  // Clean up
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* */ }
  try { fs.rmSync(sandboxBase, { recursive: true, force: true }); } catch { /* */ }
});

function initGitRepo(dir: string): void {
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
  fs.writeFileSync(path.join(dir, 'file.txt'), 'hello');
  execSync('git add .', { cwd: dir, stdio: 'pipe' });
  execSync('git commit -m "init"', { cwd: dir, stdio: 'pipe' });
}

describe('createSandbox', () => {
  it('creates a worktree sandbox in a git repo', async () => {
    initGitRepo(tmpDir);

    const sandbox = await createSandbox({
      workspacePath: tmpDir,
      runId: 'test-run-1',
      strategy: 'worktree',
    });

    expect(sandbox.strategy).toBe('worktree');
    expect(sandbox.path).toBe(path.join(sandboxBase, 'test-run-1'));
    expect(fs.existsSync(sandbox.path)).toBe(true);
    expect(fs.existsSync(path.join(sandbox.path, 'file.txt'))).toBe(true);

    // Cleanup
    await sandbox.cleanup();
  });

  it('cleanup removes the worktree sandbox', async () => {
    initGitRepo(tmpDir);

    const sandbox = await createSandbox({
      workspacePath: tmpDir,
      runId: 'test-run-cleanup',
      strategy: 'worktree',
    });

    const sandboxPath = sandbox.path;
    expect(fs.existsSync(sandboxPath)).toBe(true);

    await sandbox.cleanup();

    expect(fs.existsSync(sandboxPath)).toBe(false);
  });

  it('creates a copy sandbox', async () => {
    // Create some files in the workspace
    fs.writeFileSync(path.join(tmpDir, 'hello.txt'), 'world');
    fs.mkdirSync(path.join(tmpDir, 'subdir'));
    fs.writeFileSync(path.join(tmpDir, 'subdir', 'nested.txt'), 'nested');

    const sandbox = await createSandbox({
      workspacePath: tmpDir,
      runId: 'test-run-copy',
      strategy: 'copy',
    });

    // On macOS it tries copy-on-write first
    expect(['copy', 'copy-on-write']).toContain(sandbox.strategy);
    expect(fs.existsSync(sandbox.path)).toBe(true);

    await sandbox.cleanup();
    expect(fs.existsSync(sandbox.path)).toBe(false);
  });

  it('auto strategy picks worktree for git repos', async () => {
    initGitRepo(tmpDir);

    const sandbox = await createSandbox({
      workspacePath: tmpDir,
      runId: 'test-run-auto',
      strategy: 'auto',
    });

    expect(sandbox.strategy).toBe('worktree');
    await sandbox.cleanup();
  });

  it('auto strategy falls back to copy for non-git directories', async () => {
    fs.writeFileSync(path.join(tmpDir, 'hello.txt'), 'world');

    const sandbox = await createSandbox({
      workspacePath: tmpDir,
      runId: 'test-run-auto-copy',
      strategy: 'auto',
    });

    expect(['copy', 'copy-on-write']).toContain(sandbox.strategy);
    await sandbox.cleanup();
  });

  it('throws when worktree strategy is used on non-git directory', async () => {
    fs.writeFileSync(path.join(tmpDir, 'hello.txt'), 'world');

    await expect(
      createSandbox({
        workspacePath: tmpDir,
        runId: 'test-run-fail',
        strategy: 'worktree',
      }),
    ).rejects.toThrow('Cannot use worktree strategy');
  });
});

describe('cleanupStaleSandboxes', () => {
  it('removes old directories and keeps new ones', async () => {
    // Create an "old" directory
    const oldDir = path.join(sandboxBase, 'old-run');
    fs.mkdirSync(oldDir, { recursive: true });
    // Set mtime to 2 hours ago
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    fs.utimesSync(oldDir, twoHoursAgo, twoHoursAgo);

    // Create a "new" directory
    const newDir = path.join(sandboxBase, 'new-run');
    fs.mkdirSync(newDir, { recursive: true });
    // mtime is now (just created)

    const removed = await cleanupStaleSandboxes(tmpDir, 60 * 60 * 1000); // 1 hour max age

    expect(removed).toBe(1);
    expect(fs.existsSync(oldDir)).toBe(false);
    expect(fs.existsSync(newDir)).toBe(true);
  });

  it('returns 0 when sandbox base does not exist', async () => {
    // Use a non-existent sandbox dir
    process.env.RUNNER_SANDBOX_DIR = path.join(os.tmpdir(), 'nonexistent-sandbox-dir-' + Date.now());
    const removed = await cleanupStaleSandboxes(tmpDir);
    expect(removed).toBe(0);
  });

  it('returns 0 when no directories are stale', async () => {
    // Create a fresh directory
    const freshDir = path.join(sandboxBase, 'fresh-run');
    fs.mkdirSync(freshDir, { recursive: true });

    const removed = await cleanupStaleSandboxes(tmpDir, 60 * 60 * 1000);
    expect(removed).toBe(0);
    expect(fs.existsSync(freshDir)).toBe(true);
  });
});

describe('createSandbox edge cases', () => {
  it('creates a sandbox with explicit copy strategy', async () => {
    fs.writeFileSync(path.join(tmpDir, 'hello.txt'), 'world');

    const sandbox = await createSandbox({
      workspacePath: tmpDir,
      runId: 'test-explicit-copy',
      strategy: 'copy',
    });

    expect(['copy', 'copy-on-write']).toContain(sandbox.strategy);
    expect(fs.existsSync(sandbox.path)).toBe(true);
    expect(fs.readFileSync(path.join(sandbox.path, 'hello.txt'), 'utf-8')).toBe('world');

    await sandbox.cleanup();
  });

  it('sandbox creates files that do not appear in original workspace', async () => {
    fs.writeFileSync(path.join(tmpDir, 'original.txt'), 'original');

    const sandbox = await createSandbox({
      workspacePath: tmpDir,
      runId: 'test-isolation',
      strategy: 'copy',
    });

    // Create a file inside the sandbox
    fs.writeFileSync(path.join(sandbox.path, 'sandbox-only.txt'), 'sandbox');

    // Original workspace should NOT have the new file
    expect(fs.existsSync(path.join(tmpDir, 'sandbox-only.txt'))).toBe(false);
    expect(fs.existsSync(path.join(sandbox.path, 'sandbox-only.txt'))).toBe(true);

    await sandbox.cleanup();
  });

  it('sandbox cleanup works even after error', async () => {
    fs.writeFileSync(path.join(tmpDir, 'test.txt'), 'test');

    const sandbox = await createSandbox({
      workspacePath: tmpDir,
      runId: 'test-error-cleanup',
      strategy: 'copy',
    });

    const sandboxPath = sandbox.path;
    expect(fs.existsSync(sandboxPath)).toBe(true);

    // Simulate some error occurring during the run
    // Then cleanup in a finally block
    try {
      throw new Error('simulated step failure');
    } catch {
      // The error occurred
    } finally {
      await sandbox.cleanup();
    }

    expect(fs.existsSync(sandboxPath)).toBe(false);
  });

  it('concurrent sandbox creation with different run IDs', async () => {
    fs.writeFileSync(path.join(tmpDir, 'shared.txt'), 'shared');

    const [sandbox1, sandbox2] = await Promise.all([
      createSandbox({ workspacePath: tmpDir, runId: 'concurrent-1', strategy: 'copy' }),
      createSandbox({ workspacePath: tmpDir, runId: 'concurrent-2', strategy: 'copy' }),
    ]);

    expect(sandbox1.path).not.toBe(sandbox2.path);
    expect(fs.existsSync(sandbox1.path)).toBe(true);
    expect(fs.existsSync(sandbox2.path)).toBe(true);

    // Modify one sandbox and verify the other is unaffected
    fs.writeFileSync(path.join(sandbox1.path, 'extra.txt'), 'only in sandbox1');
    expect(fs.existsSync(path.join(sandbox2.path, 'extra.txt'))).toBe(false);

    await sandbox1.cleanup();
    await sandbox2.cleanup();
  });

  it('worktree sandbox preserves file content from git', async () => {
    initGitRepo(tmpDir);
    // Add another file
    fs.writeFileSync(path.join(tmpDir, 'second.txt'), 'second');
    execSync('git add .', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git commit -m "add second"', { cwd: tmpDir, stdio: 'pipe' });

    const sandbox = await createSandbox({
      workspacePath: tmpDir,
      runId: 'test-worktree-content',
      strategy: 'worktree',
    });

    expect(fs.readFileSync(path.join(sandbox.path, 'file.txt'), 'utf-8')).toBe('hello');
    expect(fs.readFileSync(path.join(sandbox.path, 'second.txt'), 'utf-8')).toBe('second');

    await sandbox.cleanup();
  });
});
