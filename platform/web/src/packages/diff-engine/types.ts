export interface DiffFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  isGenerated: boolean;
  diff: string;
  oldPath?: string;
}

export interface DiffHunk {
  header: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  context: string;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'header';
  content: string;
  oldNumber?: number;
  newNumber?: number;
}

export interface ParsedFileDiff {
  path: string;
  hunks: DiffHunk[];
}
