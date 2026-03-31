import { Command } from 'commander';
import chalk from 'chalk';
import * as git from '../git';
import {
  listFeatures,
  loadDiffsForFeature,
} from '../workspace';
import {
  errorMessage,
  relativeTime,
  diffLabel,
  diffStatusIcon,
  featureTypePrefix,
} from '../format';

export function registerFeaturesCommand(program: Command): void {
  program
    .command('features')
    .description('List all features')
    .action(async () => {
      try {
        const features = listFeatures();

        if (features.length === 0) {
          console.log(chalk.dim('No features yet.'));
          console.log(
            chalk.dim('Start one with: devpod feature "name"'),
          );
          return;
        }

        let currentBranch: string;
        try {
          currentBranch = git.getCurrentBranch();
        } catch {
          currentBranch = '';
        }

        for (const feature of features) {
          const isCurrent = feature.branch === currentBranch;
          const marker = isCurrent ? '\u25cf' : '\u25cb';
          const markerColor = isCurrent
            ? chalk.green(marker)
            : feature.status === 'complete'
              ? chalk.green('\u2713')
              : chalk.dim(marker);

          const diffs = loadDiffsForFeature(feature);
          const prefix = featureTypePrefix(feature.type);

          let diffSummary: string;
          if (feature.status === 'complete') {
            diffSummary = 'landed';
          } else if (diffs.length === 0) {
            diffSummary = 'no diffs';
          } else {
            const parts = diffs.map((d) => {
              return `${diffLabel(d.position)} ${diffStatusIcon(d.status)}`;
            });
            const label = diffs.length === 1 ? 'diff' : 'diffs';
            diffSummary = `${diffs.length} ${label} (${parts.join(', ')})`;
          }

          const timeStr = relativeTime(feature.created);
          const nameDisplay = isCurrent
            ? chalk.bold(feature.name)
            : feature.name;

          console.log(
            `  ${markerColor} ${nameDisplay}    ${chalk.dim(prefix)}   ${diffSummary}   ${chalk.dim(timeStr)}`,
          );
        }

        console.log();
        console.log(chalk.dim('\u25cf = current'));
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });

  // devpod diffs — list diffs for current feature
  program
    .command('diffs')
    .description('List diffs for the current feature')
    .action(async () => {
      try {
        const features = listFeatures();

        let currentBranch: string;
        try {
          currentBranch = git.getCurrentBranch();
        } catch {
          currentBranch = '';
        }

        const feature = features.find((f) => f.branch === currentBranch);
        if (!feature) {
          console.log(chalk.red('No active feature.'));
          console.log(
            chalk.dim('Start one with: devpod feature "name"'),
          );
          process.exit(1);
          return;
        }

        const diffs = loadDiffsForFeature(feature);

        if (diffs.length === 0) {
          console.log(chalk.dim('No diffs yet.'));
          console.log(
            chalk.dim('Create one with: devpod diff'),
          );
          return;
        }

        console.log(
          chalk.bold(`${feature.name} \u2014 ${diffs.length} diff${diffs.length !== 1 ? 's' : ''}`),
        );
        console.log();

        for (const d of diffs.sort((a, b) => a.position - b.position)) {
          const icon = diffStatusIcon(d.status);
          const label = diffLabel(d.position);
          const stats = `${chalk.green(`+${d.additions}`)} ${chalk.red(`-${d.deletions}`)}`;
          const ciLabel =
            d.ci === 'passed'
              ? chalk.green('CI passed')
              : d.ci === 'failed'
                ? chalk.red('CI failed')
                : d.ci === 'pending'
                  ? chalk.yellow('CI running')
                  : '';

          console.log(
            `  ${icon} ${chalk.bold(label)}  ${d.title}  ${stats}  ${ciLabel}`,
          );

          if (d.files.length > 0) {
            const fileList =
              d.files.length <= 3
                ? d.files.join(', ')
                : `${d.files.slice(0, 3).join(', ')} +${d.files.length - 3} more`;
            console.log(chalk.dim(`         ${fileList}`));
          }
        }
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });
}
