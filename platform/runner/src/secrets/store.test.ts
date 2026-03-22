import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { SecretsStore } from './store.js';

let tmpDir: string;
const originalEnv = { ...process.env };

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'secrets-test-'));
  // Clear secrets key to test plaintext mode
  delete process.env.RUNNER_SECRETS_KEY;
  delete process.env.GITHUB_TOKEN;
});

afterEach(() => {
  process.env.RUNNER_SECRETS_KEY = originalEnv.RUNNER_SECRETS_KEY;
  process.env.GITHUB_TOKEN = originalEnv.GITHUB_TOKEN;
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* */ }
});

describe('SecretsStore', () => {
  it('sets and gets a secret', () => {
    const store = new SecretsStore();
    // Use a temp path as workspace so the file is stored in the store's secrets dir
    store.loadForWorkspace(tmpDir);
    store.setSecret('MY_TOKEN', 'abc123');
    expect(store.getSecret('MY_TOKEN')).toBe('abc123');
  });

  it('deletes a secret', () => {
    const store = new SecretsStore();
    store.loadForWorkspace(tmpDir);
    store.setSecret('TO_DELETE', 'val');
    expect(store.getSecret('TO_DELETE')).toBe('val');
    store.deleteSecret('TO_DELETE');
    expect(store.getSecret('TO_DELETE')).toBeUndefined();
  });

  it('lists secret names only (not values)', () => {
    const store = new SecretsStore();
    store.loadForWorkspace(tmpDir);
    store.setSecret('SECRET_A', 'val_a');
    store.setSecret('SECRET_B', 'val_b');
    const names = store.listSecrets();
    expect(names).toContain('SECRET_A');
    expect(names).toContain('SECRET_B');
    // Ensure values are not in the list
    expect(names).not.toContain('val_a');
  });

  it('imports from .env format', () => {
    const store = new SecretsStore();
    store.loadForWorkspace(tmpDir);
    const envContent = `
# Comment line
API_KEY=my-api-key
DB_PASSWORD="quoted-password"
EMPTY_LINE=

SINGLE_QUOTED='single'
`;
    const count = store.importEnv(envContent);
    expect(count).toBe(4); // API_KEY, DB_PASSWORD, EMPTY_LINE, SINGLE_QUOTED
    expect(store.getSecret('API_KEY')).toBe('my-api-key');
    expect(store.getSecret('DB_PASSWORD')).toBe('quoted-password');
    expect(store.getSecret('SINGLE_QUOTED')).toBe('single');
  });

  it('getAllSecrets returns all secrets as record', () => {
    const store = new SecretsStore();
    store.loadForWorkspace(tmpDir);
    store.setSecret('A', '1');
    store.setSecret('B', '2');
    const all = store.getAllSecrets();
    expect(all).toEqual({ A: '1', B: '2' });
    // Returned object should be a copy, not a reference
    all.C = '3';
    expect(store.getSecret('C')).toBeUndefined();
  });

  it('returns undefined for unknown secret', () => {
    const store = new SecretsStore();
    store.loadForWorkspace(tmpDir);
    expect(store.getSecret('NONEXISTENT')).toBeUndefined();
  });

  it('persists secrets across store instances (plaintext mode)', () => {
    const store1 = new SecretsStore();
    store1.loadForWorkspace(tmpDir);
    store1.setSecret('PERSIST', 'persisted_value');

    // Create a new store and load from same workspace
    const store2 = new SecretsStore();
    store2.loadForWorkspace(tmpDir);
    expect(store2.getSecret('PERSIST')).toBe('persisted_value');
  });

  it('auto-includes GITHUB_TOKEN from env', () => {
    process.env.GITHUB_TOKEN = 'ghp_test123';
    const store = new SecretsStore();
    store.loadForWorkspace(tmpDir);
    expect(store.getSecret('GITHUB_TOKEN')).toBe('ghp_test123');
  });

  it('does not overwrite existing GITHUB_TOKEN with env', () => {
    const store1 = new SecretsStore();
    store1.loadForWorkspace(tmpDir);
    store1.setSecret('GITHUB_TOKEN', 'stored-token');

    process.env.GITHUB_TOKEN = 'env-token';
    const store2 = new SecretsStore();
    store2.loadForWorkspace(tmpDir);
    expect(store2.getSecret('GITHUB_TOKEN')).toBe('stored-token');
  });

  it('throws when saving without loading workspace first', () => {
    const store = new SecretsStore();
    expect(() => store.setSecret('X', 'Y')).toThrow('No workspace loaded');
  });

  it('works with encrypted mode', () => {
    process.env.RUNNER_SECRETS_KEY = 'test-master-password';
    const store1 = new SecretsStore();
    store1.loadForWorkspace(tmpDir);
    store1.setSecret('ENCRYPTED_SECRET', 'secret_value');

    const store2 = new SecretsStore();
    store2.loadForWorkspace(tmpDir);
    expect(store2.getSecret('ENCRYPTED_SECRET')).toBe('secret_value');
  });

  it('importEnv ignores comments and blank lines', () => {
    const store = new SecretsStore();
    store.loadForWorkspace(tmpDir);
    const content = `
# This is a comment

KEY1=val1
# Another comment
KEY2=val2
`;
    const count = store.importEnv(content);
    expect(count).toBe(2);
  });

  it('importEnv handles value with = sign', () => {
    const store = new SecretsStore();
    store.loadForWorkspace(tmpDir);
    const content = 'CONNECTION_STRING=postgres://user:pass@host/db?opt=val';
    const count = store.importEnv(content);
    expect(count).toBe(1);
    expect(store.getSecret('CONNECTION_STRING')).toBe('postgres://user:pass@host/db?opt=val');
  });

  // ── Edge cases ──

  it('handles secret with special characters (quotes, unicode)', () => {
    const store = new SecretsStore();
    store.loadForWorkspace(tmpDir);
    store.setSecret('SPECIAL', 'it\'s a "test" value with unicode: \u00e9\u00e8');
    expect(store.getSecret('SPECIAL')).toBe('it\'s a "test" value with unicode: \u00e9\u00e8');
  });

  it('handles secret with newlines', () => {
    const store = new SecretsStore();
    store.loadForWorkspace(tmpDir);
    const multiline = 'line1\nline2\nline3';
    store.setSecret('MULTILINE', multiline);
    expect(store.getSecret('MULTILINE')).toBe(multiline);
  });

  it('importEnv with empty lines and comments only', () => {
    const store = new SecretsStore();
    store.loadForWorkspace(tmpDir);
    const content = `
# Just comments
# And empty lines

`;
    const count = store.importEnv(content);
    expect(count).toBe(0);
  });

  it('importEnv with quoted values containing = signs', () => {
    const store = new SecretsStore();
    store.loadForWorkspace(tmpDir);
    const content = 'FORMULA="x=y+z"';
    const count = store.importEnv(content);
    expect(count).toBe(1);
    expect(store.getSecret('FORMULA')).toBe('x=y+z');
  });

  it('multiple workspaces have separate secret stores', () => {
    const tmpDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'secrets-test2-'));
    try {
      const store1 = new SecretsStore();
      store1.loadForWorkspace(tmpDir);
      store1.setSecret('WS1_SECRET', 'value1');

      const store2 = new SecretsStore();
      store2.loadForWorkspace(tmpDir2);
      store2.setSecret('WS2_SECRET', 'value2');

      // Each store should only see its own secrets
      expect(store1.getSecret('WS1_SECRET')).toBe('value1');
      expect(store1.getSecret('WS2_SECRET')).toBeUndefined();
      expect(store2.getSecret('WS2_SECRET')).toBe('value2');
      expect(store2.getSecret('WS1_SECRET')).toBeUndefined();
    } finally {
      fs.rmSync(tmpDir2, { recursive: true, force: true });
    }
  });

  it('overwrite existing secret', () => {
    const store = new SecretsStore();
    store.loadForWorkspace(tmpDir);
    store.setSecret('TOKEN', 'original');
    expect(store.getSecret('TOKEN')).toBe('original');
    store.setSecret('TOKEN', 'updated');
    expect(store.getSecret('TOKEN')).toBe('updated');
  });

  it('GITHUB_TOKEN from env does not overwrite explicit GITHUB_TOKEN secret (verified with re-load)', () => {
    // First, set an explicit GITHUB_TOKEN
    const store1 = new SecretsStore();
    store1.loadForWorkspace(tmpDir);
    store1.setSecret('GITHUB_TOKEN', 'explicit-token');

    // Now set env GITHUB_TOKEN and load again
    process.env.GITHUB_TOKEN = 'env-token-value';
    const store2 = new SecretsStore();
    store2.loadForWorkspace(tmpDir);

    // The explicit one should be preserved
    expect(store2.getSecret('GITHUB_TOKEN')).toBe('explicit-token');
  });

  it('importEnv ignores lines without = sign', () => {
    const store = new SecretsStore();
    store.loadForWorkspace(tmpDir);
    const content = 'VALID=value\nNOEQUALS\nALSO_VALID=yes';
    const count = store.importEnv(content);
    expect(count).toBe(2);
    expect(store.getSecret('VALID')).toBe('value');
    expect(store.getSecret('ALSO_VALID')).toBe('yes');
  });

  it('listSecrets returns empty array for fresh workspace', () => {
    const store = new SecretsStore();
    store.loadForWorkspace(tmpDir);
    expect(store.listSecrets()).toEqual([]);
  });
});
