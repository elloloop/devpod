import type { DiffFile } from '@/packages/diff-engine';

export interface WorkflowRun {
  id: string;
  workflow: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  conclusion?: 'success' | 'failure' | 'cancelled';
  jobs: Job[];
  createdAt: string;
  updatedAt: string;
  trigger: { event: string; ref: string; sha: string };
}

export interface Job {
  id: string;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'cancelled';
  steps: Step[];
  startedAt?: string;
  completedAt?: string;
}

export interface Step {
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'cancelled' | 'skipped';
  log: string;
}

export interface Artifact {
  id: string;
  name: string;
  path: string;
  size: number;
  mimeType: string;
}

export interface Feature {
  slug: string;
  title: string;
  description: string;
  date: string;
  prs: { number: number; title: string; repo: string; status: string }[];
  video?: string;
  screenshots: string[];
  status: 'in-progress' | 'review' | 'shipped';
}

export interface PullRequest {
  sha: string;
  shortSha: string;
  title: string;
  body: string;
  author: string;
  date: string;
  parentSha: string;
  files: DiffFile[];
  totalAdditions: number;
  totalDeletions: number;
  number?: number;
  branch?: string;
  baseBranch?: string;
  status?: string;
  checks?: WorkflowRun[];
  feature?: string;
  description?: string;
  diff?: string;
  createdAt?: string;
}

export interface ActivityItem {
  id: string;
  type: 'pr' | 'feature' | 'run';
  title: string;
  description: string;
  status: string;
  date: string;
  link: string;
}

// Stacked Diffs

export interface StackedDiff {
  uuid: string;
  position: number;
  title: string;
  description: string;
  type: string;
  status: 'draft' | 'submitted' | 'approved' | 'landed';
  ci: 'pending' | 'passed' | 'failed' | null;
  commit: string;
  files: DiffFile[];
  additions: number;
  deletions: number;
  version: number;
  created: string;
  updated: string;
}

export interface StackedFeature {
  name: string;
  type: string;
  slug: string;
  branch: string;
  created: string;
  status: string;
}

export interface FeatureWithDiffs {
  feature: StackedFeature;
  diffs: StackedDiff[];
  isCurrent: boolean;
}

export interface DiffDetail extends StackedDiff {
  diff: string;
  detailedFiles: DiffFile[];
}

// Version History / Interdiff

export interface DiffVersionInfo {
  snapshotId: string;
  snapshotSha: string;
  version: number;
  action: string;
  message: string;
  date: string;
  stack: string;
}

export interface CompareRequest {
  left: string;
  right: string;
  files?: string[];
}

export interface CompareResult {
  diff: string;
  files: DiffFile[];
  leftLabel: string;
  rightLabel: string;
}
