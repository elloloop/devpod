import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as api from '../api';
import { statusIcon, statusColor, duration, errorMessage } from '../format';

interface RunResponse {
  id: string;
  status: string;
  sandbox?: {
    type: string;
    path: string;
  };
}

interface StepEvent {
  runId: string;
  jobId?: string;
  jobName?: string;
  stepName?: string;
  status?: string;
  log?: string;
  duration?: number;
  error?: string;
}

export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description('Trigger a workflow and stream output')
    .argument('<workflow>', 'Workflow name to run')
    .option('-i, --input <pairs...>', 'Input key=value pairs')
    .option('--no-sandbox', 'Disable sandboxing')
    .option('--no-wait', 'Fire and forget, just print run ID')
    .action(async (workflow: string, opts: {
      input?: string[];
      sandbox: boolean;
      wait: boolean;
    }) => {
      try {
        const inputs: Record<string, string> = {};
        if (opts.input) {
          for (const pair of opts.input) {
            const eqIdx = pair.indexOf('=');
            if (eqIdx === -1) {
              console.error(chalk.red(`Invalid input format: ${pair} (expected key=value)`));
              process.exit(1);
            }
            inputs[pair.slice(0, eqIdx)] = pair.slice(eqIdx + 1);
          }
        }

        console.log(`${chalk.blue('\u25b6')} Triggering workflow: ${chalk.bold(workflow)}`);

        let run: RunResponse;
        try {
          run = await api.post<RunResponse>('/api/runs', {
            workflow,
            inputs: Object.keys(inputs).length > 0 ? inputs : undefined,
            sandbox: opts.sandbox,
          });
        } catch (err) {
          console.error(errorMessage(err));
          process.exit(1);
          return;
        }

        if (run.sandbox) {
          console.log(
            chalk.dim(`  Sandbox: ${run.sandbox.type} at ${run.sandbox.path}`),
          );
        }
        console.log();

        if (!opts.wait) {
          console.log(`Run ID: ${chalk.cyan(run.id)}`);
          return;
        }

        // Stream events for this run
        await streamRunEvents(run.id);
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });
}

async function streamRunEvents(runId: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const startTime = Date.now();
    const jobSpinners: Map<string, ReturnType<typeof ora>> = new Map();
    const jobStartTimes: Map<string, number> = new Map();
    let completed = false;

    const stop = api.sseStream('/api/events', (type: string, data: unknown) => {
      const event = data as StepEvent;
      if (event.runId !== runId) return;

      const jobKey = event.jobId || event.jobName || 'unknown';

      switch (type) {
        case 'job.queued': {
          const spinner = ora({
            text: `Job: ${event.jobName || jobKey} ${chalk.yellow('(queued)')}`,
            prefixText: '',
          }).start();
          jobSpinners.set(jobKey, spinner);
          jobStartTimes.set(jobKey, Date.now());
          break;
        }

        case 'job.started':
        case 'job.in_progress': {
          const spinner = jobSpinners.get(jobKey);
          if (spinner) {
            spinner.text = `Job: ${event.jobName || jobKey} ${chalk.blue('(in_progress)')}`;
          } else {
            const newSpinner = ora({
              text: `Job: ${event.jobName || jobKey} ${chalk.blue('(in_progress)')}`,
            }).start();
            jobSpinners.set(jobKey, newSpinner);
            if (!jobStartTimes.has(jobKey)) {
              jobStartTimes.set(jobKey, Date.now());
            }
          }
          break;
        }

        case 'step.log': {
          const spinner = jobSpinners.get(jobKey);
          if (spinner) spinner.stop();
          if (event.log) {
            const prefix = chalk.dim('  \u25b8 ');
            const lines = event.log.split('\n');
            for (const line of lines) {
              console.log(`${prefix}${line}`);
            }
          }
          if (spinner) spinner.start();
          break;
        }

        case 'step.completed': {
          const spinner = jobSpinners.get(jobKey);
          if (spinner) spinner.stop();
          const icon = statusIcon(event.status || 'success');
          console.log(`  ${icon} ${event.stepName || 'Step'}`);
          if (spinner) spinner.start();
          break;
        }

        case 'job.completed': {
          const spinner = jobSpinners.get(jobKey);
          if (spinner) spinner.stop();
          const jobDuration = jobStartTimes.has(jobKey)
            ? Date.now() - jobStartTimes.get(jobKey)!
            : event.duration;
          const status = event.status || 'success';
          const icon = statusIcon(status);
          const color = statusColor(status);
          const durStr = jobDuration ? ` \u2014 ${duration(jobDuration)}` : '';
          console.log(
            `${icon} Job: ${event.jobName || jobKey} ${color(`(${status})`)}${chalk.dim(durStr)}`,
          );
          console.log();
          jobSpinners.delete(jobKey);
          break;
        }

        case 'run.completed': {
          completed = true;
          // Stop any remaining spinners
          for (const spinner of jobSpinners.values()) {
            spinner.stop();
          }
          const totalMs = Date.now() - startTime;
          const status = event.status || 'success';
          const icon = statusIcon(status);
          const color = statusColor(status);
          console.log(
            `${icon} Run completed: ${color(status)} ${chalk.dim(`(${duration(totalMs)} total)`)}`,
          );
          stop();
          if (status === 'failure' || status === 'failed') {
            process.exit(1);
          }
          resolve();
          break;
        }
      }
    });

    // Timeout after 30 minutes
    const timeout = setTimeout(() => {
      if (!completed) {
        for (const spinner of jobSpinners.values()) {
          spinner.stop();
        }
        console.error(chalk.yellow('\nRun timed out waiting for events'));
        stop();
        resolve();
      }
    }, 30 * 60 * 1000);

    // Clean up timeout on resolve
    const origResolve = resolve;
    resolve = (() => {
      clearTimeout(timeout);
      origResolve();
    }) as typeof resolve;
  });
}
