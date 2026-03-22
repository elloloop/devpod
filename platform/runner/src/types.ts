// ── Workflow YAML types (parsed from .github/workflows/*.yml) ──

export interface WorkflowFile {
  name?: string;
  on: WorkflowTrigger;
  env?: Record<string, string>;
  jobs: Record<string, JobDefinition>;
}

export type WorkflowTrigger =
  | string
  | string[]
  | {
      workflow_dispatch?: WorkflowDispatchTrigger;
      workflow_call?: WorkflowCallTrigger;
      push?: PushTrigger;
      pull_request?: PullRequestTrigger;
      [key: string]: unknown;
    };

export interface WorkflowDispatchTrigger {
  inputs?: Record<string, WorkflowInput>;
}

export interface WorkflowInput {
  description?: string;
  required?: boolean;
  default?: string;
  type?: string;
  options?: string[];
}

export interface PushTrigger {
  branches?: string[];
  tags?: string[];
  paths?: string[];
}

export interface PullRequestTrigger {
  branches?: string[];
  paths?: string[];
  types?: string[];
}

export interface WorkflowCallTrigger {
  inputs?: Record<string, {
    description?: string;
    required?: boolean;
    default?: string;
    type?: string;
  }>;
  secrets?: Record<string, {
    description?: string;
    required?: boolean;
  }>;
  outputs?: Record<string, {
    description?: string;
    value: string;
  }>;
}

export interface JobDefaults {
  run?: {
    'working-directory'?: string;
    shell?: string;
  };
}

export interface JobDefinition {
  name?: string;
  'runs-on'?: string;
  needs?: string | string[];
  if?: string;
  env?: Record<string, string>;
  defaults?: JobDefaults;
  strategy?: {
    matrix: Record<string, unknown[]> & {
      include?: Record<string, unknown>[];
      exclude?: Record<string, unknown>[];
    };
    'fail-fast'?: boolean;
    'max-parallel'?: number;
  };
  steps: StepDefinition[];
  outputs?: Record<string, string>;
  services?: Record<string, ServiceDefinition>;
  'timeout-minutes'?: number;
  'working-directory'?: string;

  // Reusable workflow call fields
  uses?: string;            // e.g., './.github/workflows/tests.yml' or 'org/repo/.github/workflows/shared.yml@main'
  with?: Record<string, string>;     // inputs to pass to the called workflow
  secrets?: Record<string, string> | 'inherit';  // secrets to pass to the called workflow
}

export interface StepDefinition {
  id?: string;
  name?: string;
  run?: string;
  uses?: string;
  with?: Record<string, string>;
  env?: Record<string, string>;
  if?: string;
  'working-directory'?: string;
  shell?: string;
  'continue-on-error'?: boolean;
  'timeout-minutes'?: number;
}

export interface ServiceDefinition {
  image: string;
  ports?: string[];
  env?: Record<string, string>;
  volumes?: string[];
  options?: string;
}

// ── Action YAML types (parsed from action.yml) ──

export interface ActionDefinition {
  name: string;
  description?: string;
  inputs?: Record<string, ActionInput>;
  outputs?: Record<string, ActionOutput>;
  runs: ActionRuns;
}

export interface ActionInput {
  description?: string;
  required?: boolean;
  default?: string;
}

export interface ActionOutput {
  description?: string;
  value?: string;
}

export interface ActionRuns {
  using: 'composite' | 'node12' | 'node16' | 'node20' | 'docker';
  steps?: StepDefinition[];
  main?: string;
  pre?: string;
  post?: string;
  'pre-if'?: string;
  'post-if'?: string;
  image?: string;
  entrypoint?: string;
  args?: string[];
  env?: Record<string, string>;
}

// ── Runtime types ──

export type RunStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
export type Conclusion = 'success' | 'failure' | 'cancelled' | 'skipped';

export interface WorkflowRun {
  id: string;
  workflow: string;
  status: RunStatus;
  conclusion?: Conclusion;
  jobs: Job[];
  createdAt: string;
  updatedAt: string;
  trigger: {
    event: string;
    ref: string;
    sha: string;
  };
  inputs?: Record<string, string>;
  env?: Record<string, string>;
  sandbox?: {
    path: string;
    strategy: string;
  };
}

export interface Job {
  id: string;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: Conclusion;
  steps: Step[];
  startedAt?: string;
  completedAt?: string;
  outputs: Record<string, string>;
}

export interface Step {
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: Conclusion;
  log: string;
  outputs: Record<string, string>;
  number: number;
}

export interface Artifact {
  id: string;
  name: string;
  path: string;
  size: number;
  mimeType: string;
  runId: string;
}

// ── SSE event types ──

export type SSEEventType =
  | 'run.started'
  | 'run.completed'
  | 'job.started'
  | 'job.completed'
  | 'step.started'
  | 'step.completed'
  | 'step.log';

export interface SSEEvent {
  type: SSEEventType;
  runId: string;
  jobId?: string;
  stepNumber?: number;
  data: unknown;
}

// ── Expression evaluation context ──

export interface ExpressionContext {
  github: Record<string, unknown>;
  env: Record<string, string>;
  inputs: Record<string, string>;
  steps: Record<string, { outputs: Record<string, string>; outcome: string; conclusion: string }>;
  needs: Record<string, { outputs: Record<string, string>; result: string }>;
  jobs: Record<string, { outputs: Record<string, string> }>;
  runner: Record<string, string>;
  matrix: Record<string, string>;
  secrets: Record<string, string>;
}

// ── Parsed workflow info ──

export interface WorkflowInfo {
  name: string;
  fileName: string;
  filePath: string;
  triggers: string[];
  jobs: { id: string; name: string; needs: string[] }[];
  inputs?: Record<string, WorkflowInput>;
}
