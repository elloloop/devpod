import { Command } from 'commander';
import chalk from 'chalk';
import * as git from '../git';
import {
  loadConfig,
  getCurrentFeature,
  loadDiffsForFeature,
  saveDiff,
  saveUndoEntry,
} from '../workspace';
import {
  errorMessage,
  conflictMessage,
  nextStepHint,
  diffLabel,
  diffStatusIcon,
} from '../format';

function autoSaveChanges(cwd?: string): void {
  if (!git.isClean(cwd)) {
    git.stageAll(cwd);
    git.commit('WIP: auto-save before sync', cwd);
  }
}

function updateDiffShas(featureSlug: string): void {
  // After rebase, commit SHAs have changed. Walk the log and update diffs.
  // Since we can't easily map old SHAs to new, we re-derive from position.
  // Diffs are ordered by position; commits are in chronological order on the branch.
  const feature = getCurrentFeature();
  if (!feature) return;

  const config = loadConfig();
  const diffs = loadDiffsForFeature(feature).sort(
    (a, b) => a.position - b.position,
  );

  if (diffs.length === 0) return;

  // Get the commits between default branch and HEAD
  const commits = git.getCommitsBetween(
    `origin/${config.defaultBranch}`,
    'HEAD',
  );

  // Map commits to diffs by position order
  // The oldest commit (first in list) maps to D1, etc.
  const orderedCommits = [...commits].reverse();
  for (let i = 0; i < diffs.length && i < orderedCommits.length; i++) {
    const d = diffs[i]!;
    const c = orderedCommits[i]!;
    d.commit = c.sha;
    d.updated = new Date().toISOString();
    saveDiff(d);
  }
}

export function registerSyncCommand(program: Command): void {
  program
    .command('sync')
    .description('Sync your work with the latest code')
    .option('--continue', 'Continue after resolving conflicts')
    .option('--abort', 'Abort sync in progress')
    .action(
      async (opts: { continue?: boolean; abort?: boolean }) => {
        try {
          if (opts.abort) {
            git.rebaseAbort();
            console.log(
              `${chalk.green('\u2713')} Sync aborted. You are back where you started.`,
            );
            return;
          }

          if (opts.continue) {
            const result = git.rebaseContinue();
            if (!result.success && result.conflicts) {
              console.log(chalk.red('Still have conflicts:'));
              for (const file of result.conflicts) {
                console.log(`  ${conflictMessage(file)}`);
              }
              console.log();
              console.log(
                chalk.dim(
                  'Fix the conflicts, then run: devpod sync --continue',
                ),
              );
              process.exit(1);
              return;
            }

            const feature = getCurrentFeature();
            if (feature) {
              git.pushForce(feature.branch);
              updateDiffShas(feature.slug);
            }

            console.log(
              `${chalk.green('\u2713')} Synced \u2014 your work is on top of the latest code.`,
            );
            console.log(nextStepHint('sync'));
            return;
          }

          // Normal sync
          const feature = getCurrentFeature();
          if (!feature) {
            console.log(chalk.red('No active feature.'));
            console.log(
              chalk.dim('Start one with: devpod feature "name"'),
            );
            process.exit(1);
            return;
          }

          // Save undo entry
          const headBefore = git.getHeadSha();
          saveUndoEntry({
            action: 'sync',
            timestamp: new Date().toISOString(),
            refBefore: headBefore,
            description: 'Sync with latest code',
            data: { branch: feature.branch },
          });

          // Auto-save uncommitted changes
          autoSaveChanges();

          // Fetch and rebase
          const config = loadConfig();
          git.fetchMain();

          const result = git.rebaseOnto(`origin/${config.defaultBranch}`);

          if (!result.success && result.conflicts) {
            console.log(chalk.red('Conflicts found:'));
            for (const file of result.conflicts) {
              console.log(`  ${conflictMessage(file)}`);
            }
            console.log();
            console.log(
              chalk.dim(
                'Fix the conflicts, then run: devpod sync --continue',
              ),
            );
            process.exit(1);
            return;
          }

          // Push and update metadata
          git.pushForce(feature.branch);
          updateDiffShas(feature.slug);

          // Show result
          const diffs = loadDiffsForFeature(feature);
          console.log(
            `${chalk.green('\u2713')} Synced \u2014 your work is on top of the latest code.`,
          );

          if (diffs.length > 0) {
            const stackParts = diffs.map((d) => {
              return `${diffLabel(d.position)} ${diffStatusIcon(d.status)}`;
            });
            console.log(
              chalk.dim(`  Stack: ${stackParts.join(' \u2192 ')}`),
            );
          }

          console.log(nextStepHint('sync'));
        } catch (err) {
          console.error(errorMessage(err));
          process.exit(1);
        }
      },
    );
}
