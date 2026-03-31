import { Command } from 'commander';
import chalk from 'chalk';
import * as api from '../api';
import {
  statusIcon,
  statusColor,
  relativeTime,
  duration,
  table,
  indent,
  errorMessage,
} from '../format';

interface Run {
  id: string;
  workflow: string;
  status: string;
  duration?: number;
  startedAt?: string;
  completedAt?: string;
  jobs?: Job[];
}

interface Job {
  id: string;
  name: string;
  status: string;
  duration?: number;
  steps?: Step[];
}

interface Step {
  name: string;
  status: string;
  duration?: number;
  log?: string;
}

export function registerRunsCommand(program: Command): void {
  const runs = program
    .command('runs')
    .description('List and inspect workflow runs');

  // Default action: list runs
  runs
    .option('-s, --status <status>', 'Filter by status')
    .option('-l, --limit <n>', 'Limit number of results', '10')
    .action(async (opts: { status?: string; limit: string }) => {
      try {
        const params = new URLSearchParams();
        if (opts.status) params.set('status', opts.status);
        params.set('limit', opts.limit);

        const data = await api.get<Run[]>(`/api/runs?${params.toString()}`);

        if (!data || data.length === 0) {
          console.log(chalk.dim('No runs found.'));
          return;
        }

        const rows = data.map((run) => {
          const icon = statusIcon(run.status);
          const color = statusColor(run.status);
          const dur = run.duration ? duration(run.duration) : '\u2014';
          const started = run.startedAt
            ? relativeTime(run.startedAt)
            : '\u2014';
          return [
            chalk.cyan(run.id.slice(0, 8)),
            run.workflow,
            `${icon} ${color(run.status)}`,
            dur,
            chalk.dim(started),
          ];
        });

        console.log(
          table(rows, ['ID', 'Workflow', 'Status', 'Duration', 'Started']),
        );
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });

  // View a specific run
  runs
    .command('view')
    .description('View details of a specific run')
    .argument('<id>', 'Run ID')
    .action(async (id: string) => {
      try {
        const run = await api.get<Run>(`/api/runs/${id}`);

        const icon = statusIcon(run.status);
        const color = statusColor(run.status);

        console.log(`${chalk.bold('Run')} ${chalk.cyan(run.id)}`);
        console.log(`Workflow: ${chalk.bold(run.workflow)}`);
        console.log(`Status:   ${icon} ${color(run.status)}`);
        if (run.duration) {
          console.log(`Duration: ${duration(run.duration)}`);
        }
        if (run.startedAt) {
          console.log(`Started:  ${relativeTime(run.startedAt)}`);
        }
        console.log();

        if (run.jobs && run.jobs.length > 0) {
          console.log(chalk.bold('Jobs:'));
          for (const job of run.jobs) {
            const jobIcon = statusIcon(job.status);
            const jobColor = statusColor(job.status);
            const jobDur = job.duration ? ` \u2014 ${duration(job.duration)}` : '';
            console.log(
              `  ${jobIcon} ${job.name} ${jobColor(`(${job.status})`)}${chalk.dim(jobDur)}`,
            );

            if (job.steps && job.steps.length > 0) {
              for (const step of job.steps) {
                const stepIcon = statusIcon(step.status);
                console.log(`    ${stepIcon} ${step.name}`);
              }
            }
          }
        }
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });

  // Show logs for a run
  runs
    .command('logs')
    .description('Print full logs for a run')
    .argument('<id>', 'Run ID')
    .action(async (id: string) => {
      try {
        const run = await api.get<Run>(`/api/runs/${id}`);

        if (run.jobs && run.jobs.length > 0) {
          for (const job of run.jobs) {
            console.log(chalk.bold(`\u2500\u2500 ${job.name} \u2500\u2500`));
            if (job.steps) {
              for (const step of job.steps) {
                console.log(chalk.cyan(`\u25b8 ${step.name}`));
                if (step.log) {
                  console.log(indent(step.log));
                }
              }
            }
            console.log();
          }
        } else {
          // Fallback: fetch raw logs
          const logs = await api.get<string>(`/api/runs/${id}/logs`);
          console.log(logs);
        }
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });
}
