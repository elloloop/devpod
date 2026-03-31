import express, { Request, Response, Router } from 'express';
import cors from 'cors';
import * as fs from 'node:fs';
import { WorkflowExecutor, RunSandboxOptions } from './engine/executor.js';
import { listWorkflows, getWorkflowInfo, findWorkflow } from './engine/parser.js';
import { SecretsStore } from './secrets/store.js';
import { SSEEvent } from './types.js';

export function createServer(executor: WorkflowExecutor, workspacePath: string, secretsStore?: SecretsStore): express.Application {
  const app = express();

  app.use(cors());
  app.use(express.json());

  const router = Router();

  // ── Workflow runs ──

  // POST /api/runs - Trigger a workflow run
  router.post('/runs', async (req: Request, res: Response) => {
    try {
      const { workflow, inputs, sandbox } = req.body as {
        workflow?: string;
        inputs?: Record<string, string>;
        sandbox?: {
          strategy?: 'worktree' | 'copy' | 'none';
          ref?: string;
        };
      };

      if (!workflow) {
        res.status(400).json({ error: 'Missing required field: workflow' });
        return;
      }

      const sandboxOpts: RunSandboxOptions | undefined = sandbox
        ? { strategy: sandbox.strategy, ref: sandbox.ref }
        : undefined;

      const run = await executor.triggerRun(workflow, inputs, sandboxOpts);
      res.status(201).json(run);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: message });
    }
  });

  // GET /api/runs - List runs
  router.get('/runs', (req: Request, res: Response) => {
    const status = req.query.status as string | undefined;
    const runs = executor.listRuns(status as any);
    res.json(runs);
  });

  // GET /api/runs/:id - Get run detail
  router.get('/runs/:id', (req: Request, res: Response) => {
    const run = executor.getRun(req.params.id);
    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }
    res.json(run);
  });

  // GET /api/runs/:id/logs - Get full logs
  router.get('/runs/:id/logs', (req: Request, res: Response) => {
    const run = executor.getRun(req.params.id);
    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }
    const logs = executor.getRunLogs(req.params.id);
    res.type('text/plain').send(logs);
  });

  // GET /api/runs/:id/artifacts - List artifacts
  router.get('/runs/:id/artifacts', (req: Request, res: Response) => {
    const run = executor.getRun(req.params.id);
    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }
    const artifacts = executor.artifacts.listArtifacts(req.params.id);
    res.json(artifacts);
  });

  // GET /api/runs/:id/artifacts/:name - Download artifact
  router.get('/runs/:id/artifacts/:name', (req: Request, res: Response) => {
    const run = executor.getRun(req.params.id);
    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }

    const artifact = executor.artifacts.getArtifact(req.params.id, req.params.name);
    if (!artifact) {
      res.status(404).json({ error: 'Artifact not found' });
      return;
    }

    if (!fs.existsSync(artifact.path)) {
      res.status(404).json({ error: 'Artifact file not found on disk' });
      return;
    }

    res.setHeader('Content-Type', artifact.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${artifact.name}"`);
    const stream = fs.createReadStream(artifact.path);
    stream.pipe(res);
  });

  // POST /api/runs/:id/cancel - Cancel a running workflow
  router.post('/runs/:id/cancel', (req: Request, res: Response) => {
    const success = executor.cancelRun(req.params.id);
    if (!success) {
      const run = executor.getRun(req.params.id);
      if (!run) {
        res.status(404).json({ error: 'Run not found' });
        return;
      }
      res.status(409).json({ error: 'Run is not in a cancellable state' });
      return;
    }
    res.json({ message: 'Run cancelled' });
  });

  // ── Workflows ──

  // GET /api/workflows - List available workflows
  router.get('/workflows', (_req: Request, res: Response) => {
    try {
      const workflows = listWorkflows(workspacePath);
      res.json(workflows);
    } catch (err) {
      res.status(500).json({ error: 'Failed to list workflows' });
    }
  });

  // GET /api/workflows/:name - Get workflow detail
  router.get('/workflows/:name', (req: Request, res: Response) => {
    try {
      const found = findWorkflow(workspacePath, req.params.name);
      if (!found) {
        res.status(404).json({ error: 'Workflow not found' });
        return;
      }
      const info = getWorkflowInfo(found.filePath);
      res.json({ info, definition: found.workflow });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  // ── Secrets ──

  if (secretsStore) {
    // GET /api/secrets - List secret names (not values)
    router.get('/secrets', (_req: Request, res: Response) => {
      const names = secretsStore.listSecrets();
      res.json(names);
    });

    // PUT /api/secrets/:name - Set a secret (syncs to cloud backends)
    router.put('/secrets/:name', async (req: Request, res: Response) => {
      const { value } = req.body as { value?: string };
      if (value === undefined || value === null) {
        res.status(400).json({ error: 'Missing required field: value' });
        return;
      }
      // Store locally first, then sync to backends in the background
      await secretsStore.setSecretWithSync(req.params.name, String(value));
      res.json({ message: `Secret '${req.params.name}' saved` });
    });

    // DELETE /api/secrets/:name - Delete a secret (syncs to cloud backends)
    router.delete('/secrets/:name', async (req: Request, res: Response) => {
      await secretsStore.deleteSecretWithSync(req.params.name);
      res.json({ message: `Secret '${req.params.name}' deleted` });
    });

    // POST /api/secrets/import - Import from .env file format
    router.post('/secrets/import', (req: Request, res: Response) => {
      const { content } = req.body as { content?: string };
      if (!content) {
        res.status(400).json({ error: 'Missing required field: content' });
        return;
      }
      const count = secretsStore.importEnv(content);
      res.json({ message: `Imported ${count} secrets`, count });
    });

    // POST /api/secrets/sync - Pull secrets from cloud backends and merge
    router.post('/secrets/sync', async (_req: Request, res: Response) => {
      try {
        await secretsStore.syncFromCloud();
        res.json({ message: 'Sync complete' });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
      }
    });

    // GET /api/secrets/status - Show which backends are configured
    router.get('/secrets/status', (_req: Request, res: Response) => {
      const backends = secretsStore.getBackendStatus();
      res.json({ backends });
    });
  }

  // ── SSE for real-time events ──

  router.get('/events', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Send initial ping
    res.write('event: ping\ndata: {}\n\n');

    const eventTypes: SSEEvent['type'][] = [
      'run.started',
      'run.completed',
      'job.started',
      'job.completed',
      'step.started',
      'step.completed',
      'step.log',
    ];

    const handlers: Array<{ event: string; handler: (...args: any[]) => void }> = [];

    for (const eventType of eventTypes) {
      const handler = (data: unknown) => {
        try {
          res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
        } catch {
          // Client disconnected
        }
      };
      executor.emitter.on(eventType, handler);
      handlers.push({ event: eventType, handler });
    }

    // Keep alive with periodic pings
    const keepAlive = setInterval(() => {
      try {
        res.write('event: ping\ndata: {}\n\n');
      } catch {
        clearInterval(keepAlive);
      }
    }, 30000);

    // Cleanup on disconnect
    req.on('close', () => {
      clearInterval(keepAlive);
      for (const { event, handler } of handlers) {
        executor.emitter.off(event, handler);
      }
    });
  });

  app.use('/api', router);

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', workspace: workspacePath });
  });

  return app;
}
