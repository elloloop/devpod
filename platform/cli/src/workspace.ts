import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import * as git from './git';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DevpodConfig {
  defaultBranch: string;
  llm: {
    enabled: boolean;
    provider: 'auto' | 'anthropic' | 'openai' | 'ollama' | 'custom';
    url?: string;
    model?: string;
    apiKey?: string;
  };
  ci: { autoRun: boolean };
  aliases: boolean;
}

export type ChangeType = 'feature' | 'fix' | 'docs' | 'chore' | 'unknown';
export type DiffStatus = 'draft' | 'submitted' | 'approved' | 'landed';
export type FeatureStatus = 'active' | 'submitted' | 'complete';

export interface FeatureData {
  name: string;
  type: ChangeType;
  slug: string;
  branch: string;
  created: string;
  diffs: string[];         // ordered list of diff UUIDs
  status: FeatureStatus;
}

export interface DiffData {
  uuid: string;
  feature: string;         // feature slug
  commit: string;          // current commit SHA
  position: number;        // 1-based position in stack (D1, D2...)
  title: string;           // conventional commit format
  description: string;
  type: ChangeType;
  files: string[];
  additions: number;
  deletions: number;
  version: number;         // increments on each edit
  status: DiffStatus;
  ci: 'pending' | 'passed' | 'failed' | null;
  githubPr: number | null;
  created: string;
  updated: string;
}

export interface UndoEntry {
  action: string;          // 'diff', 'sync', 'edit', 'submit', 'land'
  timestamp: string;
  refBefore: string;       // git ref before action
  description: string;     // human-readable
  data: Record<string, unknown>;  // action-specific data for reversal
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

function getRoot(cwd?: string): string {
  return git.getRepoRoot(cwd);
}

function devpodDir(cwd?: string): string {
  return path.join(getRoot(cwd), '.devpod');
}

function configFilePath(cwd?: string): string {
  return path.join(devpodDir(cwd), 'config.json');
}

function featuresDir(cwd?: string): string {
  return path.join(devpodDir(cwd), 'features');
}

function diffsDir(cwd?: string): string {
  return path.join(devpodDir(cwd), 'diffs');
}

function undoDir(cwd?: string): string {
  return path.join(devpodDir(cwd), 'undo');
}

function editingFilePath(cwd?: string): string {
  return path.join(devpodDir(cwd), '.editing');
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

export function ensureDevpodDir(cwd?: string): void {
  const root = getRoot(cwd);
  const dp = path.join(root, '.devpod');
  fs.mkdirSync(path.join(dp, 'features'), { recursive: true });
  fs.mkdirSync(path.join(dp, 'diffs'), { recursive: true });
  fs.mkdirSync(path.join(dp, 'undo'), { recursive: true });

  // Add .devpod/ to .git/info/exclude (not .gitignore)
  const excludePath = path.join(root, '.git', 'info', 'exclude');
  try {
    const excludeParent = path.dirname(excludePath);
    if (!fs.existsSync(excludeParent)) {
      fs.mkdirSync(excludeParent, { recursive: true });
    }
    const existing = fs.existsSync(excludePath)
      ? fs.readFileSync(excludePath, 'utf-8')
      : '';
    if (!existing.includes('.devpod/')) {
      fs.writeFileSync(excludePath, existing + '\n.devpod/\n');
    }
  } catch {
    // Non-fatal: exclude file couldn't be written
  }
}

/** Alias kept for backward compatibility with clone.ts */
export const ensureWorkspace = ensureDevpodDir;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: DevpodConfig = {
  defaultBranch: 'main',
  llm: { enabled: true, provider: 'auto' },
  ci: { autoRun: true },
  aliases: true,
};

export function loadConfig(cwd?: string): DevpodConfig {
  try {
    const content = fs.readFileSync(configFilePath(cwd), 'utf-8');
    const parsed = JSON.parse(content) as Partial<DevpodConfig>;
    return { ...DEFAULT_CONFIG, ...parsed, llm: { ...DEFAULT_CONFIG.llm, ...parsed.llm }, ci: { ...DEFAULT_CONFIG.ci, ...parsed.ci } };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: DevpodConfig, cwd?: string): void {
  ensureDevpodDir(cwd);
  fs.writeFileSync(configFilePath(cwd), JSON.stringify(config, null, 2) + '\n');
}

// ---------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function loadFeature(slug: string, cwd?: string): FeatureData | null {
  try {
    const filePath = path.join(featuresDir(cwd), `${slug}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as FeatureData;
  } catch {
    return null;
  }
}

export function saveFeature(feature: FeatureData, cwd?: string): void {
  ensureDevpodDir(cwd);
  const filePath = path.join(featuresDir(cwd), `${feature.slug}.json`);
  fs.writeFileSync(filePath, JSON.stringify(feature, null, 2) + '\n');
}

export function listFeatures(cwd?: string): FeatureData[] {
  try {
    const dir = featuresDir(cwd);
    if (!fs.existsSync(dir)) return [];
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    return files
      .map((f) => {
        try {
          return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as FeatureData;
        } catch {
          return null;
        }
      })
      .filter((f): f is FeatureData => f !== null);
  } catch {
    return [];
  }
}

export function getCurrentFeature(cwd?: string): FeatureData | null {
  try {
    const branch = git.getCurrentBranch(cwd);
    const features = listFeatures(cwd);
    return features.find((f) => f.branch === branch) || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Diffs
// ---------------------------------------------------------------------------

export function generateDiffUuid(): string {
  return crypto.randomUUID();
}

export function loadDiff(uuid: string, cwd?: string): DiffData | null {
  try {
    const filePath = path.join(diffsDir(cwd), `${uuid}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as DiffData;
  } catch {
    return null;
  }
}

export function saveDiff(diff: DiffData, cwd?: string): void {
  ensureDevpodDir(cwd);
  const filePath = path.join(diffsDir(cwd), `${diff.uuid}.json`);
  fs.writeFileSync(filePath, JSON.stringify(diff, null, 2) + '\n');
}

export function loadDiffsForFeature(feature: FeatureData, cwd?: string): DiffData[] {
  return feature.diffs
    .map((uuid) => loadDiff(uuid, cwd))
    .filter((d): d is DiffData => d !== null);
}

export function getNextDiffPosition(feature: FeatureData, cwd?: string): number {
  const diffs = loadDiffsForFeature(feature, cwd);
  if (diffs.length === 0) return 1;
  const maxPosition = Math.max(...diffs.map((d) => d.position));
  return maxPosition + 1;
}

export function getDiffByPosition(feature: FeatureData, position: number, cwd?: string): DiffData | null {
  const diffs = loadDiffsForFeature(feature, cwd);
  return diffs.find((d) => d.position === position) || null;
}

// ---------------------------------------------------------------------------
// Editing state
// ---------------------------------------------------------------------------

export function setEditingDiff(uuid: string | null, cwd?: string): void {
  ensureDevpodDir(cwd);
  const filePath = editingFilePath(cwd);
  if (uuid === null) {
    try { fs.unlinkSync(filePath); } catch { /* already gone */ }
  } else {
    fs.writeFileSync(filePath, uuid);
  }
}

export function getEditingDiff(cwd?: string): string | null {
  try {
    return fs.readFileSync(editingFilePath(cwd), 'utf-8').trim() || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Undo
// ---------------------------------------------------------------------------

export function saveUndoEntry(entry: UndoEntry, cwd?: string): void {
  ensureDevpodDir(cwd);
  const dir = undoDir(cwd);
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${entry.timestamp.replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(path.join(dir, filename), JSON.stringify(entry, null, 2) + '\n');
}

export function listUndoEntries(cwd?: string): UndoEntry[] {
  try {
    const dir = undoDir(cwd);
    if (!fs.existsSync(dir)) return [];
    const files = fs.readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .sort();  // chronological by timestamp-based filename
    return files
      .map((f) => {
        try {
          return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as UndoEntry;
        } catch {
          return null;
        }
      })
      .filter((e): e is UndoEntry => e !== null);
  } catch {
    return [];
  }
}

export function getLastUndoEntry(cwd?: string): UndoEntry | null {
  const entries = listUndoEntries(cwd);
  return entries.length > 0 ? entries[entries.length - 1]! : null;
}

export function removeLastUndoEntry(cwd?: string): void {
  try {
    const dir = undoDir(cwd);
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .sort();
    if (files.length > 0) {
      fs.unlinkSync(path.join(dir, files[files.length - 1]!));
    }
  } catch {
    // Non-fatal
  }
}
