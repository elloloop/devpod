import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { SecretsStore } from './store.js';
import type { SecretsBackend } from './backend.js';

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

// ── Backend integration tests ──

interface MockBackend extends SecretsBackend {
  pushCalls: Array<{ name: string; value: string }>;
  removeCalls: string[];
  pullResult: Record<string, string>;
}

function createMockBackend(overrides?: Partial<SecretsBackend>): MockBackend {
  const pushCalls: Array<{ name: string; value: string }> = [];
  const removeCalls: string[] = [];
  const pullResult: Record<string, string> = {};

  const backend: MockBackend = {
    name: overrides?.name ?? 'mock',
    pushCalls,
    removeCalls,
    pullResult,
    isAvailable: overrides?.isAvailable ?? (() => true),
    pull: overrides?.pull ?? (async () => ({ ...backend.pullResult })),
    push: overrides?.push ?? (async (name: string, value: string) => { pushCalls.push({ name, value }); }),
    remove: overrides?.remove ?? (async (name: string) => { removeCalls.push(name); }),
  };
  return backend;
}

describe('SecretsStore — backend support', () => {
  it('registers a backend that is available', () => {
    const store = new SecretsStore();
    store.loadForWorkspace(tmpDir);
    const backend = createMockBackend();
    store.addBackend(backend);
    const status = store.getBackendStatus();
    expect(status).toEqual([{ name: 'mock', available: true }]);
  });

  it('does not register a backend that is not available', () => {
    const store = new SecretsStore();
    store.loadForWorkspace(tmpDir);
    const backend = createMockBackend({ isAvailable: () => false });
    store.addBackend(backend);
    expect(store.getBackendStatus()).toEqual([]);
  });

  it('syncFromCloud merges cloud values into local (cloud fills missing keys)', async () => {
    const store = new SecretsStore();
    store.loadForWorkspace(tmpDir);
    store.setSecret('LOCAL_ONLY', 'local_val');

    const backend = createMockBackend();
    backend.pullResult = { CLOUD_SECRET: 'cloud_val', LOCAL_ONLY: 'should_not_override' };
    store.addBackend(backend);

    await store.syncFromCloud();

    // Cloud value should be merged
    expect(store.getSecret('CLOUD_SECRET')).toBe('cloud_val');
    // Local value should win on conflict
    expect(store.getSecret('LOCAL_ONLY')).toBe('local_val');
  });

  it('syncFromCloud skips empty values from pull (e.g. GitHub backend)', async () => {
    const store = new SecretsStore();
    store.loadForWorkspace(tmpDir);

    const backend = createMockBackend();
    backend.pullResult = { GH_SECRET: '' };
    store.addBackend(backend);

    await store.syncFromCloud();

    // Empty value should not be merged
    expect(store.getSecret('GH_SECRET')).toBeUndefined();
  });

  it('syncFromCloud handles backend pull failure gracefully', async () => {
    const store = new SecretsStore();
    store.loadForWorkspace(tmpDir);
    store.setSecret('EXISTING', 'val');

    const backend = createMockBackend({
      pull: async () => { throw new Error('Network timeout'); },
    });
    store.addBackend(backend);

    // Should not throw
    await store.syncFromCloud();

    // Existing secrets should still be intact
    expect(store.getSecret('EXISTING')).toBe('val');
  });

  it('setSecretWithSync stores locally and pushes to all backends', async () => {
    const store = new SecretsStore();
    store.loadForWorkspace(tmpDir);
    const backend1 = createMockBackend({ name: 'backend1' });
    const backend2 = createMockBackend({ name: 'backend2' });
    store.addBackend(backend1);
    store.addBackend(backend2);

    await store.setSecretWithSync('MY_KEY', 'my_value');

    // Local store should have the value
    expect(store.getSecret('MY_KEY')).toBe('my_value');

    // Both backends should have received the push
    expect(backend1.pushCalls).toEqual([{ name: 'MY_KEY', value: 'my_value' }]);
    expect(backend2.pushCalls).toEqual([{ name: 'MY_KEY', value: 'my_value' }]);
  });

  it('setSecretWithSync handles backend push failure gracefully', async () => {
    const store = new SecretsStore();
    store.loadForWorkspace(tmpDir);

    const failingBackend = createMockBackend({
      push: async () => { throw new Error('R2 unavailable'); },
    });
    store.addBackend(failingBackend);

    // Should not throw — error is caught and warned
    await store.setSecretWithSync('SAFE_KEY', 'safe_value');

    // Local store should still have the value
    expect(store.getSecret('SAFE_KEY')).toBe('safe_value');
  });

  it('deleteSecretWithSync removes locally and from all backends', async () => {
    const store = new SecretsStore();
    store.loadForWorkspace(tmpDir);
    store.setSecret('TO_REMOVE', 'val');

    const backend1 = createMockBackend({ name: 'backend1' });
    const backend2 = createMockBackend({ name: 'backend2' });
    store.addBackend(backend1);
    store.addBackend(backend2);

    await store.deleteSecretWithSync('TO_REMOVE');

    // Local store should not have the value
    expect(store.getSecret('TO_REMOVE')).toBeUndefined();

    // Both backends should have received the remove call
    expect(backend1.removeCalls).toEqual(['TO_REMOVE']);
    expect(backend2.removeCalls).toEqual(['TO_REMOVE']);
  });

  it('deleteSecretWithSync handles backend remove failure gracefully', async () => {
    const store = new SecretsStore();
    store.loadForWorkspace(tmpDir);
    store.setSecret('KEY_TO_DEL', 'val');

    const failingBackend = createMockBackend({
      remove: async () => { throw new Error('GitHub API error'); },
    });
    store.addBackend(failingBackend);

    // Should not throw
    await store.deleteSecretWithSync('KEY_TO_DEL');

    // Local removal should still succeed
    expect(store.getSecret('KEY_TO_DEL')).toBeUndefined();
  });

  it('unavailable backends are skipped during sync operations', async () => {
    const store = new SecretsStore();
    store.loadForWorkspace(tmpDir);

    // Create a backend that starts available but becomes unavailable
    let available = true;
    const backend = createMockBackend({
      isAvailable: () => available,
    });
    store.addBackend(backend); // Registered as available

    // Now make it unavailable
    available = false;

    await store.setSecretWithSync('KEY', 'val');

    // Backend should not have received push since it's now unavailable
    expect(backend.pushCalls).toEqual([]);
  });

  it('works correctly with no backends registered (backwards compatibility)', async () => {
    const store = new SecretsStore();
    store.loadForWorkspace(tmpDir);

    // All operations should work exactly as before
    store.setSecret('LOCAL', 'val');
    expect(store.getSecret('LOCAL')).toBe('val');

    await store.setSecretWithSync('SYNCED', 'val2');
    expect(store.getSecret('SYNCED')).toBe('val2');

    await store.deleteSecretWithSync('SYNCED');
    expect(store.getSecret('SYNCED')).toBeUndefined();

    await store.syncFromCloud(); // no-op with no backends
    expect(store.getSecret('LOCAL')).toBe('val');
  });

  it('syncFromCloud merges from multiple backends', async () => {
    const store = new SecretsStore();
    store.loadForWorkspace(tmpDir);

    const backend1 = createMockBackend({ name: 'r2' });
    backend1.pullResult = { R2_SECRET: 'from_r2', SHARED: 'r2_wins_first' };
    store.addBackend(backend1);

    const backend2 = createMockBackend({ name: 'other' });
    backend2.pullResult = { OTHER_SECRET: 'from_other', SHARED: 'other_loses' };
    store.addBackend(backend2);

    await store.syncFromCloud();

    expect(store.getSecret('R2_SECRET')).toBe('from_r2');
    expect(store.getSecret('OTHER_SECRET')).toBe('from_other');
    // First backend to set SHARED wins (since second backend sees it as already present)
    expect(store.getSecret('SHARED')).toBe('r2_wins_first');
  });

  it('getBackendStatus returns status for all registered backends', () => {
    const store = new SecretsStore();
    store.loadForWorkspace(tmpDir);

    const b1 = createMockBackend({ name: 'r2' });
    const b2 = createMockBackend({ name: 'github' });
    store.addBackend(b1);
    store.addBackend(b2);

    const status = store.getBackendStatus();
    expect(status).toEqual([
      { name: 'r2', available: true },
      { name: 'github', available: true },
    ]);
  });
});
