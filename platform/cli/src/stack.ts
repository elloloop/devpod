import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

export interface StackEntry {
  branch: string;
  pr?: number;
  title: string;
  parent: string;
}

export interface StackData {
  stack: StackEntry[];
}

const STACK_FILE = '.devpod/stack.json';

function findRepoRoot(cwd?: string): string {
  try {
    return execSync('git rev-parse --show-toplevel', {
      cwd: cwd || process.cwd(),
      encoding: 'utf-8',
    }).trim();
  } catch {
    return cwd || process.cwd();
  }
}

function stackPath(cwd?: string): string {
  const root = findRepoRoot(cwd);
  return path.join(root, STACK_FILE);
}

export function loadStack(cwd?: string): StackData {
  const file = stackPath(cwd);
  try {
    const content = fs.readFileSync(file, 'utf-8');
    return JSON.parse(content) as StackData;
  } catch {
    return { stack: [] };
  }
}

export function saveStack(data: StackData, cwd?: string): void {
  const file = stackPath(cwd);
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

export function findEntryForBranch(branch: string, cwd?: string): StackEntry | undefined {
  const data = loadStack(cwd);
  return data.stack.find((e) => e.branch === branch);
}

export function getChildren(branch: string, cwd?: string): StackEntry[] {
  const data = loadStack(cwd);
  return data.stack.filter((e) => e.parent === branch);
}

export function getCurrentBranch(cwd?: string): string {
  return execSync('git rev-parse --abbrev-ref HEAD', {
    cwd: cwd || process.cwd(),
    encoding: 'utf-8',
  }).trim();
}

export function getDefaultBranch(cwd?: string): string {
  try {
    const remote = execSync('git remote show origin', {
      cwd: cwd || process.cwd(),
      encoding: 'utf-8',
    });
    const match = remote.match(/HEAD branch:\s*(\S+)/);
    if (match) return match[1]!;
  } catch {
    // fallback
  }
  // Check if main exists
  try {
    execSync('git rev-parse --verify main', {
      cwd: cwd || process.cwd(),
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    return 'main';
  } catch {
    return 'master';
  }
}
