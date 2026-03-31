import { Command } from 'commander';
import chalk from 'chalk';
import * as api from '../api';
import * as git from '../git';
import {
  getCurrentFeature,
  loadDiffsForFeature,
  getEditingDiff,
  loadDiff,
} from '../workspace';
import {
  statusIcon,
  relativeTime,
  errorMessage,
  diffLabel,
  diffStatusIcon,
  featureTypePrefix,
} from '../format';

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
    .description('Show current status including changed files')
    .action(async () => {
      try {
        // Show feature/diff context first
        const feature = getCurrentFeature();
        if (feature) {
          const diffs = loadDiffsForFeature(feature);
          const editingUuid = getEditingDiff();

          console.log(
            `${chalk.bold('Feature:')} ${feature.name} (${featureTypePrefix(feature.type)})`,
          );

          if (diffs.length > 0) {
            const stackParts = diffs.map((d) => {
              return `${diffLabel(d.position)} ${diffStatusIcon(d.status)}`;
            });
            console.log(
              `${chalk.bold('Stack:')}   ${stackParts.join(' \u2192 ')}`,
            );
          }

          if (editingUuid) {
            const editDiff = loadDiff(editingUuid);
            if (editDiff) {
              console.log(
                chalk.yellow(
                  `  Editing ${diffLabel(editDiff.position)}: ${editDiff.title}`,
                ),
              );
            }
          }

          console.log();
        }

        // Show changed files
        try {
          const changes = git.getChangedFiles();
          if (changes.length > 0) {
            console.log(chalk.bold('Changed files:'));
            for (const change of changes) {
              const statusLabel =
                change.status === 'added'
                  ? chalk.green('added')
                  : change.status === 'deleted'
                    ? chalk.red('deleted')
                    : chalk.yellow('modified');
              console.log(`  ${statusLabel}  ${change.path}`);
            }
            console.log();
          } else if (feature) {
            console.log(chalk.dim('No uncommitted changes.'));
            console.log();
          }
        } catch {
          // Not in a git repo, skip file changes
        }

        // Show runner status
        const runnerUrl = api.getRunnerUrl();
        const isUp = await api.ping();

        if (!isUp) {
          console.log(
            `Runner: ${chalk.red('\u2717')} Not running at ${chalk.dim(runnerUrl)}`,
          );
          console.log(
            chalk.dim('  Start the runner with: devpod runner start'),
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
          console.log(
            `Runner: ${chalk.green('\u2713')} Running at ${chalk.cyan(runnerUrl)}`,
          );
          console.log(
            chalk.dim(
              `  Could not fetch full status: ${(err as Error).message}`,
            ),
          );
        }
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });
}
