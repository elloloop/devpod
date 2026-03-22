export interface WorkflowRun {
  id: string;
  workflow: string;
  status: "queued" | "in_progress" | "completed" | "failed" | "cancelled";
  conclusion?: "success" | "failure" | "cancelled";
  jobs: Job[];
  createdAt: string;
  updatedAt: string;
  trigger: { event: string; ref: string; sha: string };
}

export interface Job {
  id: string;
  name: string;
  status: "queued" | "in_progress" | "completed";
  conclusion?: "success" | "failure" | "cancelled";
  steps: Step[];
  startedAt?: string;
  completedAt?: string;
}

export interface Step {
  name: string;
  status: "queued" | "in_progress" | "completed";
  conclusion?: "success" | "failure" | "cancelled" | "skipped";
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
  status: "in-progress" | "review" | "shipped";
}

export interface DiffFile {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
  additions: number;
  deletions: number;
  isGenerated: boolean;
  diff: string;
  oldPath?: string;
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
  // Backward compat fields
  number?: number;
  branch?: string;
  baseBranch?: string;
  status?: string;
  checks?: WorkflowRun[];
  feature?: string;
  // Legacy aliases
  description?: string;
  diff?: string;
  createdAt?: string;
}

export interface ActivityItem {
  id: string;
  type: "pr" | "feature" | "run";
  title: string;
  description: string;
  status: string;
  date: string;
  link: string;
}
