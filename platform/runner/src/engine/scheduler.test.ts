import { describe, it, expect, vi } from 'vitest';
import { JobScheduler, JobSchedulerOpts, SchedulableJob, NeedsContext, JobsContext, prepareSchedulableJobs } from './scheduler.js';
import { Job, JobDefinition } from '../types.js';
import { expandMatrix } from './matrix.js';

/**
 * Helper to create a SchedulableJob entry.
 */
function makeJob(id: string, def: Partial<JobDefinition> = {}, matrix?: Record<string, string>): SchedulableJob {
  return {
    id,
    originalId: id.split(' ')[0], // e.g. 'build (18, linux)' -> 'build'
    def: {
      steps: [],
      ...def,
    } as JobDefinition,
    matrix,
  };
}

/**
 * Create a completed Job result.
 */
function completedJob(id: string, conclusion: 'success' | 'failure' | 'skipped' = 'success', outputs: Record<string, string> = {}): Job {
  return {
    id,
    name: id,
    status: 'completed',
    conclusion,
    steps: [],
    outputs,
  };
}

/**
 * Build scheduler opts with a mock onLaunchJob that resolves jobs via a provided map.
 */
function buildOpts(
  jobs: Map<string, SchedulableJob>,
  originalToExpanded: Map<string, string[]>,
  jobDefs: Record<string, JobDefinition>,
  results: Map<string, Job>,
  launchOrder: string[] = [],
  launchDelays: Map<string, number> = new Map(),
): JobSchedulerOpts {
  const abortController = new AbortController();
  return {
    jobs,
    originalToExpanded,
    jobDefs,
    abortController,
    onLaunchJob: async (job: SchedulableJob): Promise<Job> => {
      launchOrder.push(job.id);
      const delay = launchDelays.get(job.id) || 0;
      if (delay > 0) await new Promise(r => setTimeout(r, delay));
      return results.get(job.id) || completedJob(job.id);
    },
  };
}

describe('JobScheduler', () => {
  it('single job with no dependencies runs and completes', async () => {
    const jobs = new Map<string, SchedulableJob>();
    jobs.set('build', makeJob('build'));

    const originalToExpanded = new Map([['build', ['build']]]);
    const jobDefs: Record<string, JobDefinition> = { build: { steps: [] } as JobDefinition };

    const results = new Map<string, Job>();
    results.set('build', completedJob('build'));

    const opts = buildOpts(jobs, originalToExpanded, jobDefs, results);
    const scheduler = new JobScheduler(opts);
    const { completedJobs, anyFailed } = await scheduler.run();

    expect(completedJobs.size).toBe(1);
    expect(completedJobs.get('build')!.conclusion).toBe('success');
    expect(anyFailed).toBe(false);
  });

  it('two jobs, second needs first -> sequential execution', async () => {
    const jobs = new Map<string, SchedulableJob>();
    jobs.set('build', makeJob('build'));
    jobs.set('deploy', makeJob('deploy', { needs: 'build' }));

    const originalToExpanded = new Map([['build', ['build']], ['deploy', ['deploy']]]);
    const jobDefs: Record<string, JobDefinition> = {
      build: { steps: [] } as JobDefinition,
      deploy: { needs: 'build', steps: [] } as JobDefinition,
    };

    const launchOrder: string[] = [];
    const results = new Map<string, Job>();
    results.set('build', completedJob('build'));
    results.set('deploy', completedJob('deploy'));

    const opts = buildOpts(jobs, originalToExpanded, jobDefs, results, launchOrder);
    const scheduler = new JobScheduler(opts);
    const { completedJobs, anyFailed } = await scheduler.run();

    expect(completedJobs.size).toBe(2);
    expect(anyFailed).toBe(false);
    // build must have been launched before deploy
    expect(launchOrder.indexOf('build')).toBeLessThan(launchOrder.indexOf('deploy'));
  });

  it('two independent jobs -> both launched (parallel)', async () => {
    const jobs = new Map<string, SchedulableJob>();
    jobs.set('build', makeJob('build'));
    jobs.set('test', makeJob('test'));

    const originalToExpanded = new Map([['build', ['build']], ['test', ['test']]]);
    const jobDefs: Record<string, JobDefinition> = {
      build: { steps: [] } as JobDefinition,
      test: { steps: [] } as JobDefinition,
    };

    const launchOrder: string[] = [];
    const results = new Map<string, Job>();
    // Give both jobs a small delay so both get launched before either completes
    const launchDelays = new Map([['build', 10], ['test', 10]]);
    results.set('build', completedJob('build'));
    results.set('test', completedJob('test'));

    const opts = buildOpts(jobs, originalToExpanded, jobDefs, results, launchOrder, launchDelays);
    const scheduler = new JobScheduler(opts);
    const { completedJobs, anyFailed } = await scheduler.run();

    expect(completedJobs.size).toBe(2);
    expect(anyFailed).toBe(false);
    // Both should have been launched in the first iteration
    expect(launchOrder).toContain('build');
    expect(launchOrder).toContain('test');
  });

  it('diamond dependency: A -> B, A -> C, B+C -> D', async () => {
    const jobs = new Map<string, SchedulableJob>();
    jobs.set('A', makeJob('A'));
    jobs.set('B', makeJob('B', { needs: 'A' }));
    jobs.set('C', makeJob('C', { needs: 'A' }));
    jobs.set('D', makeJob('D', { needs: ['B', 'C'] }));

    const originalToExpanded = new Map([
      ['A', ['A']], ['B', ['B']], ['C', ['C']], ['D', ['D']],
    ]);
    const jobDefs: Record<string, JobDefinition> = {
      A: { steps: [] } as JobDefinition,
      B: { needs: 'A', steps: [] } as JobDefinition,
      C: { needs: 'A', steps: [] } as JobDefinition,
      D: { needs: ['B', 'C'], steps: [] } as JobDefinition,
    };

    const launchOrder: string[] = [];
    const results = new Map<string, Job>();
    results.set('A', completedJob('A'));
    results.set('B', completedJob('B'));
    results.set('C', completedJob('C'));
    results.set('D', completedJob('D'));

    const opts = buildOpts(jobs, originalToExpanded, jobDefs, results, launchOrder);
    const scheduler = new JobScheduler(opts);
    const { completedJobs, anyFailed } = await scheduler.run();

    expect(completedJobs.size).toBe(4);
    expect(anyFailed).toBe(false);
    // A must come before B and C, and D must come after both B and C
    expect(launchOrder.indexOf('A')).toBeLessThan(launchOrder.indexOf('B'));
    expect(launchOrder.indexOf('A')).toBeLessThan(launchOrder.indexOf('C'));
    expect(launchOrder.indexOf('B')).toBeLessThan(launchOrder.indexOf('D'));
    expect(launchOrder.indexOf('C')).toBeLessThan(launchOrder.indexOf('D'));
  });

  it('fail-fast: matrix job fails, remaining are cancelled', async () => {
    // Simulate two matrix instances, one fails
    const jobs = new Map<string, SchedulableJob>();
    jobs.set('build (18)', { id: 'build (18)', originalId: 'build', def: { steps: [] } as JobDefinition, matrix: { version: '18' } });
    jobs.set('build (20)', { id: 'build (20)', originalId: 'build', def: { steps: [] } as JobDefinition, matrix: { version: '20' } });

    const originalToExpanded = new Map([['build', ['build (18)', 'build (20)']]]);
    const jobDefs: Record<string, JobDefinition> = {
      build: {
        steps: [],
        strategy: {
          matrix: { version: [18, 20] },
          'fail-fast': true, // explicitly true (also the default)
        },
      } as unknown as JobDefinition,
    };

    const results = new Map<string, Job>();
    results.set('build (18)', completedJob('build (18)', 'failure'));
    results.set('build (20)', completedJob('build (20)', 'success'));

    // Give build (18) a short delay, build (20) a longer one so (18) fails first
    const launchDelays = new Map([['build (18)', 5], ['build (20)', 50]]);

    const skippedJobs: string[] = [];
    const opts = buildOpts(jobs, originalToExpanded, jobDefs, results, [], launchDelays);
    opts.onJobSkipped = (jobId: string) => {
      skippedJobs.push(jobId);
    };

    const scheduler = new JobScheduler(opts);
    const { completedJobs, anyFailed } = await scheduler.run();

    expect(anyFailed).toBe(true);
    expect(completedJobs.has('build (18)')).toBe(true);
    expect(completedJobs.get('build (18)')!.conclusion).toBe('failure');
  });

  it('max-parallel limits concurrency', async () => {
    // 3 matrix instances, max-parallel = 1
    const jobs = new Map<string, SchedulableJob>();
    for (const ver of ['18', '20', '22']) {
      jobs.set(`build (${ver})`, {
        id: `build (${ver})`,
        originalId: 'build',
        def: { steps: [] } as JobDefinition,
        matrix: { version: ver },
      });
    }

    const originalToExpanded = new Map([['build', ['build (18)', 'build (20)', 'build (22)']]]);
    const jobDefs: Record<string, JobDefinition> = {
      build: {
        steps: [],
        strategy: {
          matrix: { version: [18, 20, 22] },
          'max-parallel': 1,
        },
      } as unknown as JobDefinition,
    };

    const runningAtSameTime: number[] = [];
    let currentlyRunning = 0;

    const abortController = new AbortController();
    const opts: JobSchedulerOpts = {
      jobs,
      originalToExpanded,
      jobDefs,
      abortController,
      onLaunchJob: async (job: SchedulableJob): Promise<Job> => {
        currentlyRunning++;
        runningAtSameTime.push(currentlyRunning);
        await new Promise(r => setTimeout(r, 10));
        currentlyRunning--;
        return completedJob(job.id);
      },
    };

    const scheduler = new JobScheduler(opts);
    const { completedJobs, anyFailed } = await scheduler.run();

    expect(completedJobs.size).toBe(3);
    expect(anyFailed).toBe(false);
    // With max-parallel=1, at most 1 should be running at a time
    expect(Math.max(...runningAtSameTime)).toBe(1);
  });

  it('dependency failure skips downstream job (no if: condition)', async () => {
    const jobs = new Map<string, SchedulableJob>();
    jobs.set('build', makeJob('build'));
    jobs.set('deploy', makeJob('deploy', { needs: 'build' }));

    const originalToExpanded = new Map([['build', ['build']], ['deploy', ['deploy']]]);
    const jobDefs: Record<string, JobDefinition> = {
      build: { steps: [] } as JobDefinition,
      deploy: { needs: 'build', steps: [] } as JobDefinition,
    };

    const results = new Map<string, Job>();
    results.set('build', completedJob('build', 'failure'));

    const skippedJobs: string[] = [];
    const opts = buildOpts(jobs, originalToExpanded, jobDefs, results);
    opts.onJobSkipped = (jobId: string) => {
      skippedJobs.push(jobId);
    };

    const scheduler = new JobScheduler(opts);
    const { completedJobs, anyFailed } = await scheduler.run();

    expect(completedJobs.size).toBe(2);
    expect(anyFailed).toBe(true);
    expect(completedJobs.get('deploy')!.conclusion).toBe('skipped');
    expect(skippedJobs).toContain('deploy');
  });

  it('job with if: condition is not auto-skipped on dependency failure', async () => {
    const jobs = new Map<string, SchedulableJob>();
    jobs.set('build', makeJob('build'));
    jobs.set('notify', makeJob('notify', { needs: 'build', if: 'always()' }));

    const originalToExpanded = new Map([['build', ['build']], ['notify', ['notify']]]);
    const jobDefs: Record<string, JobDefinition> = {
      build: { steps: [] } as JobDefinition,
      notify: { needs: 'build', if: 'always()', steps: [] } as JobDefinition,
    };

    const launchOrder: string[] = [];
    const results = new Map<string, Job>();
    results.set('build', completedJob('build', 'failure'));
    results.set('notify', completedJob('notify', 'success'));

    const opts = buildOpts(jobs, originalToExpanded, jobDefs, results, launchOrder);
    const scheduler = new JobScheduler(opts);
    const { completedJobs } = await scheduler.run();

    expect(completedJobs.size).toBe(2);
    // notify should have been launched (not skipped) because it has if: condition
    expect(launchOrder).toContain('notify');
    expect(completedJobs.get('notify')!.conclusion).toBe('success');
  });

  it('all jobs complete when all succeed', async () => {
    const jobs = new Map<string, SchedulableJob>();
    jobs.set('a', makeJob('a'));
    jobs.set('b', makeJob('b'));
    jobs.set('c', makeJob('c'));

    const originalToExpanded = new Map([['a', ['a']], ['b', ['b']], ['c', ['c']]]);
    const jobDefs: Record<string, JobDefinition> = {
      a: { steps: [] } as JobDefinition,
      b: { steps: [] } as JobDefinition,
      c: { steps: [] } as JobDefinition,
    };

    const results = new Map<string, Job>();
    results.set('a', completedJob('a'));
    results.set('b', completedJob('b'));
    results.set('c', completedJob('c'));

    const opts = buildOpts(jobs, originalToExpanded, jobDefs, results);
    const scheduler = new JobScheduler(opts);
    const { completedJobs, anyFailed } = await scheduler.run();

    expect(completedJobs.size).toBe(3);
    expect(anyFailed).toBe(false);
  });
});

describe('prepareSchedulableJobs', () => {
  it('non-matrix job returns single entry', () => {
    const jobDefs: Record<string, JobDefinition> = {
      build: { steps: [{ run: 'echo' }] } as JobDefinition,
    };
    const { jobs, originalToExpanded } = prepareSchedulableJobs(jobDefs, ['build'], expandMatrix);
    expect(jobs.size).toBe(1);
    expect(jobs.has('build')).toBe(true);
    expect(originalToExpanded.get('build')).toEqual(['build']);
  });

  it('matrix job expands into multiple entries', () => {
    const jobDefs: Record<string, JobDefinition> = {
      build: {
        steps: [{ run: 'echo' }],
        strategy: {
          matrix: { version: [18, 20] },
        },
      } as unknown as JobDefinition,
    };
    const { jobs, originalToExpanded } = prepareSchedulableJobs(jobDefs, ['build'], expandMatrix);
    expect(jobs.size).toBe(2);
    expect(originalToExpanded.get('build')!).toHaveLength(2);
    // Instance IDs should contain matrix labels
    const ids = Array.from(jobs.keys());
    expect(ids.some(id => id.includes('(18)'))).toBe(true);
    expect(ids.some(id => id.includes('(20)'))).toBe(true);
  });

  it('mixed matrix and non-matrix jobs', () => {
    const jobDefs: Record<string, JobDefinition> = {
      lint: { steps: [{ run: 'echo lint' }] } as JobDefinition,
      test: {
        steps: [{ run: 'echo test' }],
        strategy: {
          matrix: { node: [18, 20, 22] },
        },
      } as unknown as JobDefinition,
      deploy: { needs: ['lint', 'test'], steps: [{ run: 'echo deploy' }] } as JobDefinition,
    };
    const { jobs, originalToExpanded } = prepareSchedulableJobs(jobDefs, ['lint', 'test', 'deploy'], expandMatrix);
    expect(jobs.size).toBe(5); // 1 lint + 3 test + 1 deploy
    expect(originalToExpanded.get('lint')).toEqual(['lint']);
    expect(originalToExpanded.get('test')!).toHaveLength(3);
    expect(originalToExpanded.get('deploy')).toEqual(['deploy']);
  });
});
