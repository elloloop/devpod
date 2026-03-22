import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { Artifact } from '../types.js';

const ARTIFACTS_DIR = path.join(process.cwd(), '.artifacts');

/**
 * In-memory store for artifact metadata, backed by local filesystem for content.
 */
export class ArtifactStore {
  private artifacts: Map<string, Artifact[]> = new Map(); // runId -> artifacts

  constructor(private baseDir: string = ARTIFACTS_DIR) {
    fs.mkdirSync(this.baseDir, { recursive: true });
  }

  /**
   * Save a file as an artifact for a run.
   */
  saveArtifact(runId: string, name: string, sourcePath: string): Artifact {
    const runDir = path.join(this.baseDir, runId);
    fs.mkdirSync(runDir, { recursive: true });

    const id = crypto.randomUUID();
    const ext = path.extname(sourcePath) || '';
    const destFileName = `${name}${ext}`;
    const destPath = path.join(runDir, destFileName);

    fs.copyFileSync(sourcePath, destPath);

    const stats = fs.statSync(destPath);
    const mimeType = guessMimeType(ext);

    const artifact: Artifact = {
      id,
      name,
      path: destPath,
      size: stats.size,
      mimeType,
      runId,
    };

    const runArtifacts = this.artifacts.get(runId) || [];
    runArtifacts.push(artifact);
    this.artifacts.set(runId, runArtifacts);

    return artifact;
  }

  /**
   * Save artifact from content buffer.
   */
  saveArtifactFromBuffer(runId: string, name: string, content: Buffer, ext: string = ''): Artifact {
    const runDir = path.join(this.baseDir, runId);
    fs.mkdirSync(runDir, { recursive: true });

    const id = crypto.randomUUID();
    const destFileName = `${name}${ext}`;
    const destPath = path.join(runDir, destFileName);

    fs.writeFileSync(destPath, content);

    const mimeType = guessMimeType(ext);

    const artifact: Artifact = {
      id,
      name,
      path: destPath,
      size: content.length,
      mimeType,
      runId,
    };

    const runArtifacts = this.artifacts.get(runId) || [];
    runArtifacts.push(artifact);
    this.artifacts.set(runId, runArtifacts);

    return artifact;
  }

  /**
   * List all artifacts for a given run.
   */
  listArtifacts(runId: string): Artifact[] {
    return this.artifacts.get(runId) || [];
  }

  /**
   * Get a specific artifact by name for a run.
   */
  getArtifact(runId: string, name: string): Artifact | undefined {
    const runArtifacts = this.artifacts.get(runId) || [];
    return runArtifacts.find(a => a.name === name);
  }

  /**
   * Get artifact by ID.
   */
  getArtifactById(id: string): Artifact | undefined {
    for (const artifacts of this.artifacts.values()) {
      const found = artifacts.find(a => a.id === id);
      if (found) return found;
    }
    return undefined;
  }

  /**
   * Delete all artifacts for a run.
   */
  deleteRunArtifacts(runId: string): void {
    const runDir = path.join(this.baseDir, runId);
    if (fs.existsSync(runDir)) {
      fs.rmSync(runDir, { recursive: true });
    }
    this.artifacts.delete(runId);
  }
}

function guessMimeType(ext: string): string {
  const map: Record<string, string> = {
    '.json': 'application/json',
    '.txt': 'text/plain',
    '.log': 'text/plain',
    '.html': 'text/html',
    '.xml': 'application/xml',
    '.zip': 'application/zip',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.pdf': 'application/pdf',
    '.csv': 'text/csv',
    '.yml': 'text/yaml',
    '.yaml': 'text/yaml',
    '.js': 'application/javascript',
    '.ts': 'application/typescript',
    '.bin': 'application/octet-stream',
  };
  return map[ext.toLowerCase()] || 'application/octet-stream';
}
