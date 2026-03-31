import { Command } from 'commander';
import chalk from 'chalk';
import { execSync } from 'node:child_process';
import * as git from '../git';
import {
  getLastUndoEntry,
  listUndoEntries,
  removeLastUndoEntry,
  loadDiff,
  saveDiff,
  loadFeature,
  saveFeature,
} from '../workspace';
import { errorMessage, relativeTime, diffLabel } from '../format';

export function registerUndoCommand(program: Command): void {
  program
    .command('undo')
    .description('Undo the last action')
    .option('--list', 'Show what can be undone')
    .action(async (opts: { list?: boolean }) => {
      try {
        if (opts.list) {
          const entries = listUndoEntries();
          if (entries.length === 0) {
            console.log(chalk.dim('Nothing to undo.'));
            return;
          }

          console.log(chalk.bold('Undo history (newest first):'));
          console.log();

          for (let i = entries.length - 1; i >= 0; i--) {
            const entry = entries[i]!;
            const time = relativeTime(entry.timestamp);
            const isLatest = i === entries.length - 1;
            const marker = isLatest ? chalk.cyan('\u25b6') : chalk.dim('\u2022');
            console.log(
              `  ${marker} ${entry.description}  ${chalk.dim(time)}`,
            );
          }

          console.log();
          console.log(
            chalk.dim('Run "devpod undo" to undo the latest action.'),
          );
          return;
        }

        const entry = getLastUndoEntry();
        if (!entry) {
          console.log(chalk.dim('Nothing to undo.'));
          return;
        }

        switch (entry.action) {
          case 'diff-create': {
            // Undo diff creation: reset HEAD~1 + remove diff metadata
            execSync('git reset HEAD~1', {
              stdio: 'pipe',
              encoding: 'utf-8',
            });

            // Find and remove the diff from metadata
            // The data should have the diff uuid or we can find the newest one
            const data = entry.data as { uuid?: string; featureSlug?: string };
            if (data.uuid) {
              const diff = loadDiff(data.uuid);
              if (diff && data.featureSlug) {
                const feature = loadFeature(data.featureSlug);
                if (feature) {
                  feature.diffs = feature.diffs.filter(
                    (id) => id !== data.uuid,
                  );
                  saveFeature(feature);
                }
              }
            }

            removeLastUndoEntry();
            console.log(
              `${chalk.green('\u2713')} Undone: ${entry.description}`,
            );
            console.log(
              chalk.dim('  Your changes are preserved as uncommitted files.'),
            );
            break;
          }

          case 'diff-update': {
            // Undo diff update: hard reset to refBefore
            execSync(`git reset --hard ${entry.refBefore}`, {
              stdio: 'pipe',
              encoding: 'utf-8',
            });

            const data = entry.data as {
              uuid?: string;
              previousCommit?: string;
            };
            if (data.uuid && data.previousCommit) {
              const diff = loadDiff(data.uuid);
              if (diff) {
                diff.commit = data.previousCommit;
                diff.version = Math.max(1, diff.version - 1);
                saveDiff(diff);
              }
            }

            removeLastUndoEntry();
            console.log(
              `${chalk.green('\u2713')} Undone: ${entry.description}`,
            );
            break;
          }

          case 'diff-edit': {
            // Undo entering edit mode: hard reset to refBefore, clear editing state
            execSync(`git reset --hard ${entry.refBefore}`, {
              stdio: 'pipe',
              encoding: 'utf-8',
            });

            const { setEditingDiff } = require('../workspace');
            setEditingDiff(null);

            removeLastUndoEntry();
            console.log(
              `${chalk.green('\u2713')} Undone: ${entry.description}`,
            );
            break;
          }

          case 'sync': {
            // Undo sync: hard reset to refBefore
            execSync(`git reset --hard ${entry.refBefore}`, {
              stdio: 'pipe',
              encoding: 'utf-8',
            });

            removeLastUndoEntry();
            console.log(
              `${chalk.green('\u2713')} Undone: ${entry.description}`,
            );
            break;
          }

          case 'submit': {
            // Undo submit: reset diff statuses to draft
            const data = entry.data as {
              diffs?: string[];
            };
            if (data.diffs) {
              for (const uuid of data.diffs) {
                const diff = loadDiff(uuid);
                if (diff) {
                  diff.status = 'draft';
                  diff.updated = new Date().toISOString();
                  saveDiff(diff);
                }
              }
            }

            removeLastUndoEntry();
            console.log(
              `${chalk.green('\u2713')} Undone: ${entry.description}`,
            );
            console.log(
              chalk.dim('  Diff statuses reset to draft.'),
            );
            break;
          }

          case 'land': {
            console.log(
              chalk.red('Cannot undo a land \u2014 changes have already been pushed to the main codebase.'),
            );
            console.log(
              chalk.dim('If needed, revert the change manually.'),
            );
            break;
          }

          default: {
            // Generic undo via hard reset
            if (entry.refBefore) {
              execSync(`git reset --hard ${entry.refBefore}`, {
                stdio: 'pipe',
                encoding: 'utf-8',
              });
              removeLastUndoEntry();
              console.log(
                `${chalk.green('\u2713')} Undone: ${entry.description}`,
              );
            } else {
              console.log(
                chalk.red(`Cannot undo action "${entry.action}" \u2014 no restore point saved.`),
              );
            }
            break;
          }
        }
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });
}
