import { Command } from 'commander';
import chalk from 'chalk';
import * as api from '../api';
import { statusIcon, relativeTime, errorMessage } from '../format';

interface StatusResponse {
  runner: {
    status: string;
    url: string;
  };
  workspace?: string;
  workflows?: number;
  secrets?: number;
  backends?: { name: string; status: string }[];
  recentRuns?: {
    workflow: string;
    status: string;
    startedAt?: string;
  }[];
}

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Quick health check and overview')
    .action(async () => {
      const runnerUrl = api.getRunnerUrl();
      const isUp = await api.ping();

      if (!isUp) {
        console.log(
          `Runner: ${chalk.red('\u2717')} Not running at ${chalk.dim(runnerUrl)}`,
        );
        console.log(
          chalk.dim('  Start the runner with: devpod start'),
        );
        return;
      }

      try {
        const data = await api.get<StatusResponse>('/api/status');

        console.log(
          `Runner: ${chalk.green('\u2713')} Running at ${chalk.cyan(data.runner?.url || runnerUrl)}`,
        );

        if (data.workspace) {
          console.log(`Workspace: ${data.workspace}`);
        }

        console.log();

        if (data.workflows !== undefined) {
          console.log(`Workflows: ${data.workflows} available`);
        }
        if (data.secrets !== undefined) {
          console.log(`Secrets: ${data.secrets} configured`);
        }

        if (data.backends && data.backends.length > 0) {
          const backendStr = data.backends
            .map((b) => {
              const icon =
                b.status === 'connected' || b.status === 'active'
                  ? chalk.green('\u2713')
                  : chalk.red('\u2717');
              return `${b.name} ${icon}`;
            })
            .join(', ');
          console.log(`Backends: ${backendStr}`);
        }

        if (data.recentRuns && data.recentRuns.length > 0) {
          console.log();
          console.log('Recent runs:');
          for (const run of data.recentRuns) {
            const icon = statusIcon(run.status);
            const when = run.startedAt
              ? chalk.dim(` \u2014 ${relativeTime(run.startedAt)}`)
              : '';
            console.log(`  ${icon} ${run.workflow}${when}`);
          }
        }
      } catch (err) {
        // If we got a ping but /api/status fails, show minimal info
        console.log(
          `Runner: ${chalk.green('\u2713')} Running at ${chalk.cyan(runnerUrl)}`,
        );
        console.log(chalk.dim(`  Could not fetch full status: ${(err as Error).message}`));
      }
    });
}
