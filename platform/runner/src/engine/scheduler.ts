import { Job, JobDefinition } from '../types.js';
import { matrixLabel, MatrixCombination } from './matrix.js';

// ── Public interfaces ──

export interface SchedulableJob {
  id: string;
  originalId: string;
  def: JobDefinition;
  matrix?: MatrixCombination;
}

export type NeedsContext = Record<string, { outputs: Record<string, string>; result: string }>;
export type JobsContext = Record<string, { outputs: Record<string, string> }>;

export interface JobSchedulerOpts {
  jobs: Map<string, SchedulableJob>;
  originalToExpanded: Map<string, string[]>;
  jobDefs: Record<string, JobDefinition>;
  abortController: AbortController;
  onLaunchJob: (job: SchedulableJob, needsCtx: NeedsContext, jobsCtx: JobsContext) => Promise<Job>;
  /** Called when the scheduler itself creates a skipped/cancelled job (not launched via onLaunchJob). */
  onJobSkipped?: (jobId: string, job: Job) => void;
  /** Called when a launched job (via onLaunchJob) finishes through Promise.race. */
  onLaunchedJobCompleted?: (jobId: string, job: Job) => void;
}

/**
 * Manages the pending/running/completed state machine for workflow jobs,
 * handling dependency resolution (`needs:`), fail-fast for matrix jobs,
 * and max-parallel concurrency limits.
 */
export class JobScheduler {
  private readonly jobs: Map<string, SchedulableJob>;
  private readonly originalToExpanded: Map<string, string[]>;
  private readonly jobDefs: Record<string, JobDefinition>;
  private readonly abortController: AbortController;
  private readonly onLaunchJob: (job: SchedulableJob, needsCtx: NeedsContext, jobsCtx: JobsContext) => Promise<Job>;
  private readonly onJobSkipped?: (jobId: string, job: Job) => void;
  private readonly onLaunchedJobCompleted?: (jobId: string, job: Job) => void;

  constructor(opts: JobSchedulerOpts) {
    this.jobs = opts.jobs;
    this.originalToExpanded = opts.originalToExpanded;
    this.jobDefs = opts.jobDefs;
    this.abortController = opts.abortController;
    this.onLaunchJob = opts.onLaunchJob;
    this.onJobSkipped = opts.onJobSkipped;
    this.onLaunchedJobCompleted = opts.onLaunchedJobCompleted;
  }

  /** Run the scheduling loop until all jobs complete. Returns all completed jobs. */
  async run(): Promise<{ completedJobs: Map<string, Job>; anyFailed: boolean }> {
    const completedJobs: Map<string, Job> = new Map();
    let anyFailed = false;

    // Track per-original-job matrix abort for fail-fast
    const matrixAborted: Set<string> = new Set();

    // Execute jobs respecting dependencies, with parallelism where possible
    const pending = new Set(this.jobs.keys());
    const running = new Map<string, Promise<Job>>();

    while (pending.size > 0 || running.size > 0) {
      if (this.abortController.signal.aborted) break;

      // Find jobs whose dependencies are all completed
      const ready: string[] = [];
      for (const instanceId of pending) {
        const entry = this.jobs.get(instanceId)!;
        const def = entry.def;
        const needs = normalizeNeeds(def.needs);

        // All expanded instances of each dependency must be completed
        const allMet = needs.every(depId => {
          const expandedIds = this.originalToExpanded.get(depId) || [depId];
          return expandedIds.every(eid => completedJobs.has(eid));
        });

        if (allMet) {
          // Check if any dependency failed
          const anyDepFailed = needs.some(depId => {
            const expandedIds = this.originalToExpanded.get(depId) || [depId];
            return expandedIds.some(eid => completedJobs.get(eid)?.conclusion === 'failure');
          });

          if (anyDepFailed && !def.if) {
            const skippedJob: Job = {
              id: instanceId,
              name: def.name ? `${def.name} ${entry.matrix ? matrixLabel(entry.matrix) : ''}`.trim() : instanceId,
              status: 'completed',
              conclusion: 'skipped',
              steps: [],
              outputs: {},
            };
            completedJobs.set(instanceId, skippedJob);
            pending.delete(instanceId);
            this.onJobSkipped?.(instanceId, skippedJob);
            continue;
          }

          // If this matrix instance was aborted via fail-fast, skip it
          if (matrixAborted.has(entry.originalId)) {
            const cancelledJob: Job = {
              id: instanceId,
              name: def.name ? `${def.name} ${entry.matrix ? matrixLabel(entry.matrix) : ''}`.trim() : instanceId,
              status: 'completed',
              conclusion: 'cancelled',
              steps: [],
              outputs: {},
            };
            completedJobs.set(instanceId, cancelledJob);
            pending.delete(instanceId);
            this.onJobSkipped?.(instanceId, cancelledJob);
            continue;
          }

          ready.push(instanceId);
        }
      }

      // Enforce max-parallel for matrix jobs: group ready instances by original job
      // and limit how many can run concurrently
      const launchable: string[] = [];
      const readyByOriginal = new Map<string, string[]>();
      for (const instanceId of ready) {
        const entry = this.jobs.get(instanceId)!;
        const group = readyByOriginal.get(entry.originalId) || [];
        group.push(instanceId);
        readyByOriginal.set(entry.originalId, group);
      }

      for (const [originalId, instances] of readyByOriginal) {
        const def = this.jobDefs[originalId];
        const maxParallel = def?.strategy?.['max-parallel'];

        if (maxParallel !== undefined && maxParallel > 0) {
          // Count how many instances of this original job are currently running
          let currentlyRunning = 0;
          for (const [runningId] of running) {
            const runningEntry = this.jobs.get(runningId);
            if (runningEntry && runningEntry.originalId === originalId) {
              currentlyRunning++;
            }
          }
          const canLaunch = Math.max(0, maxParallel - currentlyRunning);
          launchable.push(...instances.slice(0, canLaunch));
        } else {
          launchable.push(...instances);
        }
      }

      // Launch ready jobs
      for (const instanceId of launchable) {
        pending.delete(instanceId);

        const entry = this.jobs.get(instanceId)!;
        const def = entry.def;
        const needs = normalizeNeeds(def.needs);

        // Build needs context: merge outputs from all expanded instances of each dependency
        const needsCtx: NeedsContext = {};
        for (const depId of needs) {
          const expandedIds = this.originalToExpanded.get(depId) || [depId];
          const mergedOutputs: Record<string, string> = {};
          let worstResult = 'success';
          for (const eid of expandedIds) {
            const completedJob = completedJobs.get(eid);
            if (completedJob) {
              Object.assign(mergedOutputs, completedJob.outputs);
              if (completedJob.conclusion === 'failure') worstResult = 'failure';
              else if (completedJob.conclusion === 'cancelled' && worstResult !== 'failure') worstResult = 'cancelled';
              else if (completedJob.conclusion === 'skipped' && worstResult === 'success') worstResult = 'skipped';
            }
          }
          needsCtx[depId] = { outputs: mergedOutputs, result: worstResult };
        }

        const jobsCtx: JobsContext = {};
        for (const [id, job] of completedJobs) {
          jobsCtx[id] = { outputs: job.outputs };
        }

        const jobPromise = this.onLaunchJob(entry, needsCtx, jobsCtx);
        running.set(instanceId, jobPromise);
      }

      if (running.size === 0 && pending.size > 0) {
        // Check if all pending are just blocked by max-parallel on running jobs
        if (launchable.length === 0 && ready.length === 0) {
          console.error('Deadlock detected in job dependency graph');
          break;
        }
        if (launchable.length === 0) {
          console.error('Deadlock detected in job dependency graph');
          break;
        }
      }

      if (running.size > 0) {
        // Wait for any job to complete
        const entries = Array.from(running.entries());
        const results = await Promise.race(
          entries.map(async ([id, promise]) => {
            const job = await promise;
            return { id, job };
          }),
        );

        running.delete(results.id);
        completedJobs.set(results.id, results.job);

        this.onLaunchedJobCompleted?.(results.id, results.job);

        if (results.job.conclusion === 'failure') {
          anyFailed = true;

          // Handle fail-fast: if this job is a matrix instance and fail-fast is enabled,
          // mark all remaining pending instances of the same original job for cancellation
          const entry = this.jobs.get(results.id);
          if (entry) {
            const originalId = entry.originalId;
            const origDef = this.jobDefs[originalId];
            // fail-fast defaults to true when a matrix strategy is defined
            const failFast = origDef?.strategy?.['fail-fast'] !== false && origDef?.strategy?.matrix !== undefined;
            if (failFast) {
              matrixAborted.add(originalId);
            }
          }
        }
      }
    }

    return { completedJobs, anyFailed };
  }
}

// ── Matrix expansion helpers ──

/**
 * Expand matrix strategies for all jobs and build the mapping from original job
 * IDs to their expanded instance IDs. Downstream `needs:` references resolve
 * correctly because a job that needs a matrix job waits for ALL instances.
 */
export function prepareSchedulableJobs(
  jobDefs: Record<string, JobDefinition>,
  jobOrder: string[],
  expandMatrix: (strategy: NonNullable<JobDefinition['strategy']>) => MatrixCombination[],
): { jobs: Map<string, SchedulableJob>; originalToExpanded: Map<string, string[]> } {
  const jobs: Map<string, SchedulableJob> = new Map();
  const originalToExpanded: Map<string, string[]> = new Map();

  for (const jobId of jobOrder) {
    const def = jobDefs[jobId];
    if (def.strategy?.matrix) {
      const combinations = expandMatrix(def.strategy);
      if (combinations.length > 0) {
        const instanceIds: string[] = [];
        for (const combo of combinations) {
          const label = matrixLabel(combo);
          const instanceId = `${jobId} ${label}`;
          instanceIds.push(instanceId);
          jobs.set(instanceId, { id: instanceId, def, matrix: combo, originalId: jobId });
        }
        originalToExpanded.set(jobId, instanceIds);
        continue;
      }
    }
    // Non-matrix job or empty matrix: keep as-is
    jobs.set(jobId, { id: jobId, def, originalId: jobId });
    originalToExpanded.set(jobId, [jobId]);
  }

  return { jobs, originalToExpanded };
}

// ── Dependency resolution ──

function normalizeNeeds(needs: string | string[] | undefined): string[] {
  if (!needs) return [];
  if (typeof needs === 'string') return [needs];
  return needs;
}
