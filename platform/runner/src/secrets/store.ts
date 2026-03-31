/**
 * Local secrets store.
 *
 * Stores secrets in ~/.local/share/local-runner/secrets/
 * Each project (workspace) gets its own secrets file.
 * Secrets are encrypted at rest using AES-256-GCM with a key derived from a master password.
 *
 * If no master password is set (RUNNER_SECRETS_KEY env var), secrets are stored in plaintext
 * JSON (still better than nothing for local dev).
 *
 * Supports pluggable cloud backends (R2, GitHub) for syncing secrets across machines.
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { SecretsBackend } from './backend.js';

const SECRETS_DIR = path.join(os.homedir(), '.local', 'share', 'local-runner', 'secrets');
const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 32; // AES-256
const SALT = 'local-runner-secrets-salt'; // Static salt is fine for local dev tool

interface PlaintextFile {
  [key: string]: string;
}

interface EncryptedFile {
  encrypted: true;
  iv: string;
  data: string;
}

type SecretsFile = PlaintextFile | EncryptedFile;

function isEncryptedFile(obj: unknown): obj is EncryptedFile {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    (obj as Record<string, unknown>).encrypted === true &&
    typeof (obj as Record<string, unknown>).iv === 'string' &&
    typeof (obj as Record<string, unknown>).data === 'string'
  );
}

export function hashWorkspacePath(workspacePath: string): string {
  return crypto.createHash('sha256').update(workspacePath).digest('hex').slice(0, 16);
}

function deriveKey(password: string): Buffer {
  return crypto.pbkdf2Sync(password, SALT, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');
}

function encrypt(data: string, key: Buffer): { iv: string; ciphertext: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(data, 'utf-8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();
  // Append auth tag to ciphertext
  const combined = encrypted + '.' + authTag.toString('base64');
  return { iv: iv.toString('base64'), ciphertext: combined };
}

function decrypt(ciphertext: string, iv: string, key: Buffer): string {
  const [encData, authTagB64] = ciphertext.split('.');
  const ivBuf = Buffer.from(iv, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, ivBuf);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encData, 'base64', 'utf-8');
  decrypted += decipher.final('utf-8');
  return decrypted;
}

export class SecretsStore {
  private secrets: Record<string, string> = {};
  private filePath: string = '';
  private encryptionKey: Buffer | null = null;
  private backends: SecretsBackend[] = [];

  constructor() {
    const masterPassword = process.env.RUNNER_SECRETS_KEY;
    if (masterPassword) {
      this.encryptionKey = deriveKey(masterPassword);
    }
  }

  /**
   * Register a cloud backend for syncing secrets.
   */
  addBackend(backend: SecretsBackend): void {
    if (backend.isAvailable()) {
      this.backends.push(backend);
    }
  }

  /**
   * Get the list of registered backends and their availability.
   */
  getBackendStatus(): Array<{ name: string; available: boolean }> {
    return this.backends.map((b) => ({ name: b.name, available: b.isAvailable() }));
  }

  /**
   * Sync from cloud: pull from all readable backends, merge into local.
   * Cloud values fill in missing keys; local values win on conflict.
   * Called on startup.
   */
  async syncFromCloud(): Promise<void> {
    for (const backend of this.backends) {
      if (!backend.isAvailable()) continue;

      try {
        const cloudSecrets = await backend.pull();
        let merged = 0;
        for (const [key, value] of Object.entries(cloudSecrets)) {
          // Only fill in keys we don't already have locally.
          // Skip empty values (e.g. GitHub backend returns empty strings).
          if (!(key in this.secrets) && value !== '') {
            this.secrets[key] = value;
            merged++;
          }
        }
        if (merged > 0) {
          this.save();
          console.log(`[secrets] Synced ${merged} secret(s) from ${backend.name} backend`);
        }
      } catch (err) {
        console.warn(
          `[secrets] Failed to sync from ${backend.name}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  /**
   * Load secrets for a given workspace path.
   */
  loadForWorkspace(workspacePath: string): void {
    const hash = hashWorkspacePath(workspacePath);
    this.filePath = path.join(SECRETS_DIR, `${hash}.json`);
    this.secrets = {};

    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed: SecretsFile = JSON.parse(raw);

        if (isEncryptedFile(parsed)) {
          if (!this.encryptionKey) {
            console.warn('Secrets file is encrypted but RUNNER_SECRETS_KEY is not set. Cannot load secrets.');
            return;
          }
          const decrypted = decrypt(parsed.data, parsed.iv, this.encryptionKey);
          this.secrets = JSON.parse(decrypted);
        } else {
          // Plaintext mode
          this.secrets = parsed as PlaintextFile;
        }
      } catch (err) {
        console.warn(`Failed to load secrets from ${this.filePath}:`, err instanceof Error ? err.message : String(err));
        this.secrets = {};
      }
    }

    // Auto-include GITHUB_TOKEN from env if not already set
    if (!this.secrets.GITHUB_TOKEN && process.env.GITHUB_TOKEN) {
      this.secrets.GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    }
  }

  /**
   * Get a secret by name.
   */
  getSecret(name: string): string | undefined {
    return this.secrets[name];
  }

  /**
   * Set a secret value (local only).
   */
  setSecret(name: string, value: string): void {
    this.secrets[name] = value;
    this.save();
  }

  /**
   * Set a secret and sync to all cloud backends.
   * Stores locally first (fast), then pushes to backends in the background.
   */
  async setSecretWithSync(name: string, value: string): Promise<void> {
    this.secrets[name] = value;
    this.save();

    // Push to all backends in the background (don't await sequentially)
    const pushPromises = this.backends
      .filter((b) => b.isAvailable())
      .map((b) =>
        b.push(name, value).catch((err) => {
          console.warn(
            `[secrets] Failed to push '${name}' to ${b.name}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }),
      );

    await Promise.allSettled(pushPromises);
  }

  /**
   * Delete a secret by name (local only).
   */
  deleteSecret(name: string): void {
    delete this.secrets[name];
    this.save();
  }

  /**
   * Delete a secret and sync deletion to all cloud backends.
   */
  async deleteSecretWithSync(name: string): Promise<void> {
    delete this.secrets[name];
    this.save();

    const removePromises = this.backends
      .filter((b) => b.isAvailable())
      .map((b) =>
        b.remove(name).catch((err) => {
          console.warn(
            `[secrets] Failed to remove '${name}' from ${b.name}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }),
      );

    await Promise.allSettled(removePromises);
  }

  /**
   * List all secret names (not values).
   */
  listSecrets(): string[] {
    return Object.keys(this.secrets);
  }

  /**
   * Get all secrets as a record (for passing to expression context).
   */
  getAllSecrets(): Record<string, string> {
    return { ...this.secrets };
  }

  /**
   * Import secrets from a .env file format string.
   * Lines are KEY=VALUE pairs, with # comments and blank lines ignored.
   */
  importEnv(content: string): number {
    let count = 0;
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const eqIdx = trimmed.indexOf('=');
      if (eqIdx <= 0) continue;

      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();

      // Strip surrounding quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      this.secrets[key] = value;
      count++;
    }

    this.save();
    return count;
  }

  // ── Private ──

  private save(): void {
    if (!this.filePath) {
      throw new Error('No workspace loaded. Call loadForWorkspace() first.');
    }

    // Ensure directory exists
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });

    // Build the secrets to persist (exclude auto-included GITHUB_TOKEN from env)
    const toSave = { ...this.secrets };

    if (this.encryptionKey) {
      const plaintext = JSON.stringify(toSave);
      const { iv, ciphertext } = encrypt(plaintext, this.encryptionKey);
      const encrypted: EncryptedFile = { encrypted: true, iv, data: ciphertext };
      fs.writeFileSync(this.filePath, JSON.stringify(encrypted, null, 2), { mode: 0o600 });
    } else {
      fs.writeFileSync(this.filePath, JSON.stringify(toSave, null, 2), { mode: 0o600 });
    }
  }
}
