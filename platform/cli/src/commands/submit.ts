import { Command } from 'commander';
import chalk from 'chalk';
import { execSync } from 'node:child_process';
import * as git from '../git';
import * as api from '../api';
import {
  loadConfig,
  getCurrentFeature,
  loadDiffsForFeature,
  saveDiff,
  saveFeature,
  saveUndoEntry,
} from '../workspace';
import {
  errorMessage,
  diffLabel,
  diffStatusIcon,
  featureTypePrefix,
  nextStepHint,
} from '../format';

function execQuiet(cmd: string): string | null {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' }).trim();
  } catch {
    return null;
  }
}

export function registerSubmitCommand(program: Command): void {
  program
    .command('submit')
    .description('Submit diffs for review')
    .option('--preview', 'Show what would be submitted without doing it')
    .action(async (opts: { preview?: boolean }) => {
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

        const diffs = loadDiffsForFeature(feature);
        const draftDiffs = diffs.filter((d) => d.status === 'draft');

        if (draftDiffs.length === 0) {
          console.log(chalk.dim('All diffs already submitted.'));
          return;
        }

        // Preview mode
        if (opts.preview) {
          console.log(chalk.bold('Would submit:'));
          for (const d of draftDiffs) {
            console.log(
              `  ${diffLabel(d.position)} ${d.title} (${chalk.green(`+${d.additions}`)} ${chalk.red(`-${d.deletions}`)})`,
            );
          }
          console.log();
          console.log(
            chalk.dim(
              `Run without --preview to submit ${draftDiffs.length} diff${draftDiffs.length !== 1 ? 's' : ''}.`,
            ),
          );
          return;
        }

        // Save undo entry
        saveUndoEntry({
          action: 'submit',
          timestamp: new Date().toISOString(),
          refBefore: git.getHeadSha(),
          description: `Submit ${draftDiffs.length} diff${draftDiffs.length !== 1 ? 's' : ''}`,
          data: {
            featureSlug: feature.slug,
            diffs: draftDiffs.map((d) => d.uuid),
          },
        });

        // Push the feature branch
        git.pushForce(feature.branch);

        const config = loadConfig();

        // Create GitHub PR if none exists
        let prUrl = '';
        const existingPr = diffs.find((d) => d.githubPr !== null);

        if (!existingPr) {
          // Build PR title
          const prefix = featureTypePrefix(feature.type);
          const prTitle = `${prefix}(${feature.slug}): ${feature.name}`;

          // Build PR body from diffs
          const diffList = diffs
            .map(
              (d) =>
                `- ${diffLabel(d.position)}: ${d.title}`,
            )
            .join('\n');
          const body = `## Diffs\n\n${diffList}`;

          try {
            const result = execQuiet(
              `gh pr create --base ${config.defaultBranch} --title ${JSON.stringify(prTitle)} --body ${JSON.stringify(body)}`,
            );
            if (result) {
              prUrl = result;
            }

            // Get PR number
            const prNumStr = execQuiet(
              'gh pr view --json number --jq .number',
            );
            if (prNumStr) {
              const prNum = parseInt(prNumStr, 10);
              if (!isNaN(prNum)) {
                // Set PR number on all diffs
                for (const d of diffs) {
                  d.githubPr = prNum;
                  saveDiff(d);
                }
              }
            }
          } catch {
            // PR creation is best-effort
            console.log(
              chalk.dim('Could not create PR (gh may not be configured).'),
            );
          }
        }

        // Update draft diffs to submitted
        for (const d of draftDiffs) {
          d.status = 'submitted';
          d.updated = new Date().toISOString();
          saveDiff(d);
        }

        // Update feature status
        feature.status = 'submitted';
        saveFeature(feature);

        // Trigger CI if auto-run enabled
        if (config.ci.autoRun) {
          const isUp = await api.ping();
          if (isUp) {
            for (const d of draftDiffs) {
              try {
                await api.post('/api/runs', {
                  workflow: 'pull_request',
                  ref: feature.branch,
                  inputs: { diff: d.uuid },
                });
                d.ci = 'pending';
                saveDiff(d);
              } catch {
                // CI trigger is best-effort
              }
            }
          }
        }

        // Print summary
        console.log(
          `${chalk.green('\u2713')} Submitted ${draftDiffs.length} diff${draftDiffs.length !== 1 ? 's' : ''}`,
        );

        if (prUrl) {
          console.log(`  PR: ${chalk.cyan(prUrl)}`);
        }

        // Show stack
        const allDiffs = loadDiffsForFeature(feature);
        const stackParts = allDiffs.map((d) => {
          return `${diffLabel(d.position)} ${diffStatusIcon(d.status)}`;
        });
        console.log(chalk.dim(`  Stack: ${stackParts.join(' \u2192 ')}`));

        console.log(nextStepHint('submit'));
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });
}
