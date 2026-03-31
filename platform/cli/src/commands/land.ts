import { Command } from 'commander';
import chalk from 'chalk';
import * as git from '../git';
import {
  loadConfig,
  getCurrentFeature,
  loadDiffsForFeature,
  saveDiff,
  saveFeature,
  saveUndoEntry,
  type DiffData,
} from '../workspace';
import {
  errorMessage,
  diffLabel,
  diffStatusIcon,
  nextStepHint,
} from '../format';

function parseDiffPosition(label: string): number | null {
  const match = label.match(/^[Dd](\d+)$/);
  if (!match) return null;
  return parseInt(match[1]!, 10);
}

export function registerLandCommand(program: Command): void {
  program
    .command('land')
    .description('Land the lowest approved diff onto the main codebase')
    .argument('[label]', 'Diff label (e.g., D1). Defaults to lowest un-landed.')
    .option('--force', 'Skip approval/CI checks')
    .action(async (label: string | undefined, opts: { force?: boolean }) => {
      try {
        const feature = getCurrentFeature();
        if (!feature) {
          console.log(chalk.red('No active feature.'));
          console.log(
            chalk.dim('Start one with: devpod feature "name"'),
          );
          process.exit(1);
          return;
        }

        const diffs = loadDiffsForFeature(feature).sort(
          (a, b) => a.position - b.position,
        );

        if (diffs.length === 0) {
          console.log(chalk.dim('No diffs to land.'));
          return;
        }

        // Find the target diff
        let targetDiff: DiffData;
        const unlandedDiffs = diffs.filter((d) => d.status !== 'landed');

        if (label) {
          const position = parseDiffPosition(label);
          if (position === null) {
            console.log(
              chalk.red(`Invalid diff label: ${label}. Use format D1, D2, etc.`),
            );
            process.exit(1);
            return;
          }

          const found = diffs.find((d) => d.position === position);
          if (!found) {
            console.log(chalk.red(`${diffLabel(position)} not found.`));
            process.exit(1);
            return;
          }

          // Must be the bottom (lowest position) un-landed diff
          if (unlandedDiffs.length > 0 && found.position !== unlandedDiffs[0]!.position) {
            console.log(
              chalk.red(
                `${diffLabel(position)} is not the lowest diff. Land ${diffLabel(unlandedDiffs[0]!.position)} first.`,
              ),
            );
            process.exit(1);
            return;
          }

          targetDiff = found;
        } else {
          if (unlandedDiffs.length === 0) {
            console.log(chalk.dim('All diffs already landed.'));
            return;
          }
          targetDiff = unlandedDiffs[0]!;
        }

        // Check status
        if (!opts.force) {
          if (
            targetDiff.status !== 'approved' &&
            targetDiff.ci !== 'passed'
          ) {
            console.log(
              chalk.yellow(
                `${diffLabel(targetDiff.position)} has not been approved and CI has not passed.`,
              ),
            );
            console.log(
              chalk.dim('Use --force to land anyway.'),
            );
            process.exit(1);
            return;
          }
        }

        // Save undo entry
        saveUndoEntry({
          action: 'land',
          timestamp: new Date().toISOString(),
          refBefore: git.getHeadSha(),
          description: `Land ${diffLabel(targetDiff.position)}: ${targetDiff.title}`,
          data: {
            uuid: targetDiff.uuid,
            featureSlug: feature.slug,
          },
        });

        const config = loadConfig();
        const featureBranch = feature.branch;

        // Switch to main, pull latest
        git.switchBranch(config.defaultBranch);
        git.fetchMain();
        git.rebaseOnto(`origin/${config.defaultBranch}`);

        // Cherry-pick squash the diff's commit
        git.cherryPickSquash(targetDiff.commit);
        git.commit(targetDiff.title);

        // Push to main
        git.pushForce(config.defaultBranch);

        // Switch back to feature branch
        git.switchBranch(featureBranch);

        // Rebase remaining diffs onto main
        const remainingDiffs = unlandedDiffs.filter(
          (d) => d.position !== targetDiff.position,
        );
        if (remainingDiffs.length > 0) {
          git.rebaseOnto(`origin/${config.defaultBranch}`);

          // Update commit SHAs for remaining diffs
          const commits = git.getCommitsBetween(
            `origin/${config.defaultBranch}`,
            'HEAD',
          );
          const orderedCommits = [...commits].reverse();
          const sortedRemaining = remainingDiffs.sort(
            (a, b) => a.position - b.position,
          );
          for (
            let i = 0;
            i < sortedRemaining.length && i < orderedCommits.length;
            i++
          ) {
            sortedRemaining[i]!.commit = orderedCommits[i]!.sha;
            saveDiff(sortedRemaining[i]!);
          }
        }

        // Update landed diff
        targetDiff.status = 'landed';
        targetDiff.updated = new Date().toISOString();
        saveDiff(targetDiff);

        // Remove from feature's diffs list
        feature.diffs = feature.diffs.filter((id) => id !== targetDiff.uuid);
        if (feature.diffs.length === 0) {
          feature.status = 'complete';
        }
        saveFeature(feature);

        // Result
        console.log(
          `${chalk.green('\u2713')} Landed ${diffLabel(targetDiff.position)}: ${targetDiff.title}`,
        );

        if (feature.diffs.length === 0) {
          console.log(
            chalk.dim('  Feature complete! All diffs landed.'),
          );
          console.log(
            chalk.dim('  You can start a new feature with: devpod feature "name"'),
          );
        } else {
          const remainingLoaded = loadDiffsForFeature(feature);
          const stackParts = remainingLoaded.map((d) => {
            return `${diffLabel(d.position)} ${diffStatusIcon(d.status)}`;
          });
          console.log(
            chalk.dim(`  Remaining: ${stackParts.join(' \u2192 ')}`),
          );
        }

        console.log(nextStepHint('land'));
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });
}
