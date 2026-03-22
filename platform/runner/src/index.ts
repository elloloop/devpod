import * as path from 'node:path';
import { createServer } from './server.js';
import { WorkflowExecutor } from './engine/executor.js';
import { ArtifactStore } from './artifacts/store.js';
import { SecretsStore } from './secrets/store.js';
import { cleanupStaleSandboxes } from './engine/sandbox.js';

const PORT = parseInt(process.env.PORT || '4800', 10);
const WORKSPACE = process.env.RUNNER_WORKSPACE || process.cwd();

// Clean up stale sandboxes from previous runs (older than 1 hour)
cleanupStaleSandboxes(WORKSPACE).then((removed) => {
  if (removed > 0) {
    console.log(`Cleaned up ${removed} stale sandbox(es) from previous runs`);
  }
}).catch((err) => {
  console.warn(`Failed to clean up stale sandboxes: ${err instanceof Error ? err.message : String(err)}`);
});

const artifactsDir = path.join(WORKSPACE, '.artifacts');
const artifactStore = new ArtifactStore(artifactsDir);
const secretsStore = new SecretsStore();
secretsStore.loadForWorkspace(WORKSPACE);
const executor = new WorkflowExecutor(WORKSPACE, artifactStore, secretsStore);
const app = createServer(executor, WORKSPACE, secretsStore);

app.listen(PORT, () => {
  console.log(`Local GitHub Actions runner started`);
  console.log(`  API:       http://localhost:${PORT}/api`);
  console.log(`  Events:    http://localhost:${PORT}/api/events`);
  console.log(`  Health:    http://localhost:${PORT}/health`);
  console.log(`  Workspace: ${WORKSPACE}`);
  console.log('');
  console.log('Endpoints:');
  console.log('  POST   /api/runs                     - Trigger a workflow run');
  console.log('  GET    /api/runs                     - List runs');
  console.log('  GET    /api/runs/:id                 - Get run detail');
  console.log('  GET    /api/runs/:id/logs            - Get full logs');
  console.log('  GET    /api/runs/:id/artifacts       - List artifacts');
  console.log('  GET    /api/runs/:id/artifacts/:name - Download artifact');
  console.log('  POST   /api/runs/:id/cancel          - Cancel a running workflow');
  console.log('  GET    /api/workflows                - List available workflows');
  console.log('  GET    /api/workflows/:name          - Get workflow detail');
  console.log('  GET    /api/secrets                   - List secret names');
  console.log('  PUT    /api/secrets/:name             - Set a secret');
  console.log('  DELETE /api/secrets/:name             - Delete a secret');
  console.log('  POST   /api/secrets/import            - Import from .env format');
  console.log('  GET    /api/events                   - SSE real-time updates');
});
