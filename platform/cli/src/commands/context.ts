import { Command } from 'commander';
import chalk from 'chalk';
import * as git from '../git';
import {
  getCurrentFeature,
  loadDiffsForFeature,
  getEditingDiff,
  loadDiff,
} from '../workspace';
import {
  errorMessage,
  diffLabel,
  diffStatusIcon,
  featureTypePrefix,
} from '../format';

export function registerContextCommand(program: Command): void {
  program
    .command('context')
    .description('Show current position in the workflow')
    .action(async () => {
      try {
        const feature = getCurrentFeature();

        if (!feature) {
          console.log(chalk.dim('No active feature.'));
          console.log(
            chalk.dim('Start one with: devpod feature "name"'),
          );
          return;
        }

        const diffs = loadDiffsForFeature(feature);
        const editingUuid = getEditingDiff();
        const editingDiff = editingUuid ? loadDiff(editingUuid) : null;

        // Feature header
        console.log(
          `${chalk.bold('Feature:')} ${feature.name} (${featureTypePrefix(feature.type)})`,
        );

        // Current diff
        if (diffs.length > 0) {
          const currentDiff = editingDiff || diffs[diffs.length - 1]!;
          const pos = currentDiff.position;
          console.log(
            `${chalk.bold('Diff:')}    ${diffLabel(pos)} of ${diffs.length} \u2014 "${currentDiff.title}"  [${currentDiff.status}]`,
          );

          if (editingDiff) {
            console.log(
              chalk.yellow(`         (editing ${diffLabel(editingDiff.position)})`),
            );
          }

          // Stack visualization
          const stackParts = diffs.map((d) => {
            const label = diffLabel(d.position);
            const icon = diffStatusIcon(d.status);
            return `${label} ${icon} ${d.status}`;
          });
          console.log(
            `${chalk.bold('Stack:')}   ${stackParts.join(' \u2192 ')}`,
          );
        } else {
          console.log(chalk.dim('No diffs yet.'));
        }

        // Changed files since last diff
        const changes = git.getChangedFiles();
        if (changes.length > 0) {
          console.log();
          console.log(chalk.bold('Changed since last diff:'));
          for (const change of changes) {
            const statusLabel =
              change.status === 'added'
                ? chalk.green('added')
                : change.status === 'deleted'
                  ? chalk.red('deleted')
                  : chalk.yellow('modified');
            console.log(`  ${statusLabel}  ${change.path}`);
          }
        }
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });
}
