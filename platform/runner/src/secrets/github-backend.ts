/**
 * GitHub Secrets backend.
 *
 * Pushes secrets to GitHub repository secrets via the `gh` CLI so that
 * real GitHub Actions workflows can consume them too.
 *
 * This backend is WRITE-ONLY for secret values — GitHub never exposes
 * secret values via API. `pull()` returns the secret names with empty
 * values so callers know what's configured.
 *
 * Env vars / config:
 *   RUNNER_GITHUB_REPO - Repository in owner/repo format (auto-detected from git remote if not set)
 */

import { execFileSync, execSync } from 'node:child_process';
import type { SecretsBackend } from './backend.js';

export class GitHubBackend implements SecretsBackend {
  readonly name = 'github';

  private repo: string | null = null;
  private available: boolean = false;

  constructor() {
    // Check if gh is installed and authenticated
    try {
      execFileSync('gh', ['auth', 'status'], { stdio: 'pipe', timeout: 10_000 });
      this.available = true;
    } catch {
      this.available = false;
      return;
    }

    // Resolve repo
    this.repo = process.env.RUNNER_GITHUB_REPO || null;
    if (!this.repo) {
      try {
        const remote = execSync('git remote get-url origin', { encoding: 'utf-8', stdio: 'pipe', timeout: 5000 }).trim();
        // Parse owner/repo from https://github.com/owner/repo.git or git@github.com:owner/repo.git
        const httpsMatch = remote.match(/github\.com\/([^/]+\/[^/.]+)/);
        const sshMatch = remote.match(/github\.com:([^/]+\/[^/.]+)/);
        const match = httpsMatch || sshMatch;
        if (match) {
          this.repo = match[1].replace(/\.git$/, '');
        }
      } catch {
        // Can't detect repo — will be unavailable
      }
    }

    if (!this.repo) {
      this.available = false;
    }
  }

  isAvailable(): boolean {
    return this.available && this.repo !== null;
  }

  async pull(): Promise<Record<string, string>> {
    if (!this.isAvailable()) return {};

    try {
      const output = execFileSync(
        'gh',
        ['secret', 'list', '--repo', this.repo!, '--json', 'name'],
        { encoding: 'utf-8', stdio: 'pipe', timeout: 15_000 },
      );

      const parsed = JSON.parse(output) as Array<{ name: string }>;
      const result: Record<string, string> = {};
      for (const entry of parsed) {
        // GitHub never exposes values — return empty strings
        result[entry.name] = '';
      }
      return result;
    } catch (err) {
      console.warn(`[github-backend] Failed to list secrets: ${err instanceof Error ? err.message : String(err)}`);
      return {};
    }
  }

  async push(name: string, value: string): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      // Use stdin via execFileSync with input option to avoid shell escaping issues
      execFileSync(
        'gh',
        ['secret', 'set', name, '--repo', this.repo!, '--body', value],
        { stdio: 'pipe', timeout: 15_000 },
      );
    } catch (err) {
      console.warn(`[github-backend] Failed to push secret '${name}': ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async remove(name: string): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      execFileSync(
        'gh',
        ['secret', 'delete', name, '--repo', this.repo!],
        { stdio: 'pipe', timeout: 15_000 },
      );
    } catch (err) {
      console.warn(`[github-backend] Failed to delete secret '${name}': ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
