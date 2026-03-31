import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as git from '../git';
import * as api from '../api';
import {
  getCurrentFeature,
  loadDiffsForFeature,
  saveDiff,
  saveFeature,
  getEditingDiff,
  setEditingDiff,
  getNextDiffPosition,
  generateDiffUuid,
  getDiffByPosition,
  loadDiff,
  saveUndoEntry,
  type DiffData,
  type ChangeType,
} from '../workspace';
import {
  generateDiffMessage,
  detectChangeType,
  generateFallbackMessage,
  isLLMAvailable,
  type LLMResult,
} from '../llm';
import {
  errorMessage,
  diffLabel,
  diffStatusIcon,
  featureTypePrefix,
  nextStepHint,
} from '../format';

function parseDiffPosition(label: string): number | null {
  const match = label.match(/^[Dd](\d+)$/);
  if (!match) return null;
  return parseInt(match[1]!, 10);
}

async function generateTitle(
  diff: string,
  files: string[],
  type: ChangeType,
  scope: string,
  explicitMessage?: string,
): Promise<LLMResult> {
  if (explicitMessage) {
    const prefix = featureTypePrefix(type);
    return {
      title: `${prefix}(${scope}): ${explicitMessage}`,
      description: '',
    };
  }

  if (isLLMAvailable()) {
    try {
      return await generateDiffMessage(diff, type, scope);
    } catch {
      return generateFallbackMessage(files, type, scope);
    }
  }

  return generateFallbackMessage(files, type, scope);
}

export function registerDiffCommand(program: Command): void {
  const diff = program
    .command('diff')
    .description('Create or update a diff (unit of change)')
    .argument('[message]', 'Explicit diff message')
    .option('--preview', 'Preview what would be in the diff without creating it')
    .option('--update', 'Explicitly update the diff being edited');

  // devpod diff (create or update)
  diff.action(
    async (
      message: string | undefined,
      opts: { preview?: boolean; update?: boolean },
    ) => {
      try {
        const feature = getCurrentFeature();
        if (!feature) {
          console.log(
            chalk.red('No active feature.'),
          );
          console.log(
            chalk.dim('Start one with: devpod feature "name"'),
          );
          process.exit(1);
          return;
        }

        const changes = git.getChangedFiles();
        const editingUuid = getEditingDiff();

        if (changes.length === 0 && !editingUuid && !opts.update) {
          console.log(chalk.dim('No changes to diff.'));
          return;
        }

        const diffContent = git.getDiff();
        const stats = git.getDiffStats();
        const changedFiles = changes.map((c) => c.path);
        const scope = feature.slug;

        // Preview mode
        if (opts.preview) {
          const result = await generateTitle(
            diffContent,
            changedFiles,
            feature.type,
            scope,
            message,
          );
          console.log(chalk.bold('Preview:'));
          console.log(`  Title: ${result.title}`);
          if (result.description) {
            console.log(`  Description: ${result.description}`);
          }
          console.log(
            `  Files: ${stats.files} (${chalk.green(`+${stats.additions}`)} ${chalk.red(`-${stats.deletions}`)})`,
          );
          for (const change of changes) {
            const statusLabel =
              change.status === 'added'
                ? chalk.green('added')
                : change.status === 'deleted'
                  ? chalk.red('deleted')
                  : chalk.yellow('modified');
            console.log(`    ${statusLabel}  ${change.path}`);
          }
          return;
        }

        // Editing mode: update existing diff
        if (editingUuid || opts.update) {
          const uuid = editingUuid || '';
          const editDiff = loadDiff(uuid);
          if (!editDiff) {
            console.log(chalk.red('No diff is being edited.'));
            process.exit(1);
            return;
          }

          // Save undo entry
          const headBefore = git.getHeadSha();
          saveUndoEntry({
            action: 'diff-update',
            timestamp: new Date().toISOString(),
            refBefore: headBefore,
            description: `Update ${diffLabel(editDiff.position)}`,
            data: { uuid, previousCommit: editDiff.commit },
          });

          // Stage and amend
          git.stageAll();
          const newSha = git.amend();

          // Update diff metadata
          editDiff.commit = newSha;
          editDiff.version += 1;
          editDiff.status = 'draft';
          editDiff.updated = new Date().toISOString();
          editDiff.files = changedFiles.length > 0 ? changedFiles : editDiff.files;

          const newStats = git.getDiffStats();
          editDiff.additions = newStats.additions;
          editDiff.deletions = newStats.deletions;

          saveDiff(editDiff);

          // Replay commits above this diff
          const diffs = loadDiffsForFeature(feature);
          const aboveDiffs = diffs
            .filter((d) => d.position > editDiff.position)
            .sort((a, b) => a.position - b.position);

          for (const above of aboveDiffs) {
            git.cherryPickSquash(above.commit);
            const newCommitSha = git.getHeadSha();
            above.commit = newCommitSha;
            saveDiff(above);
          }

          // Clear editing state
          setEditingDiff(null);

          console.log(
            `${chalk.green('\u2713')} Updated ${diffLabel(editDiff.position)}: ${editDiff.title}`,
          );

          // Print stack summary
          const allDiffs = loadDiffsForFeature(feature);
          if (allDiffs.length > 0) {
            const stackParts = allDiffs.map((d) => {
              return `${diffLabel(d.position)} ${diffStatusIcon(d.status)}`;
            });
            console.log(chalk.dim(`  Stack: ${stackParts.join(' \u2192 ')}`));
          }

          console.log(nextStepHint('diff-update'));
          return;
        }

        // New diff creation
        const spinner = ora('Generating diff message...').start();

        let result: LLMResult;
        try {
          result = await generateTitle(
            diffContent,
            changedFiles,
            feature.type,
            scope,
            message,
          );
          spinner.stop();
        } catch {
          spinner.stop();
          result = generateFallbackMessage(changedFiles, feature.type, scope);
        }

        // Save undo entry
        const headBefore = git.getHeadSha();
        saveUndoEntry({
          action: 'diff-create',
          timestamp: new Date().toISOString(),
          refBefore: headBefore,
          description: `Create diff: ${result.title}`,
          data: {},
        });

        // Stage and commit
        git.stageAll();
        const commitSha = git.commit(result.title);

        // Create diff metadata
        const position = getNextDiffPosition(feature);
        const uuid = generateDiffUuid();

        const newDiff: DiffData = {
          uuid,
          feature: feature.slug,
          commit: commitSha,
          position,
          title: result.title,
          description: result.description,
          type: feature.type,
          files: changedFiles,
          additions: stats.additions,
          deletions: stats.deletions,
          version: 1,
          status: 'draft',
          ci: null,
          githubPr: null,
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
        };

        saveDiff(newDiff);

        // Add to feature's diffs list
        feature.diffs.push(uuid);
        saveFeature(feature);

        console.log(
          `${chalk.green('\u2713')} Created ${diffLabel(position)}: ${result.title}`,
        );
        console.log(
          chalk.dim(
            `  ${stats.files} file${stats.files !== 1 ? 's' : ''} (${chalk.green(`+${stats.additions}`)} ${chalk.red(`-${stats.deletions}`)})`,
          ),
        );
        console.log(nextStepHint('diff-create'));
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    },
  );

  // devpod diff edit D1
  diff
    .command('edit')
    .description('Enter edit mode for a specific diff')
    .argument('<label>', 'Diff label (e.g., D1)')
    .action(async (label: string) => {
      try {
        const feature = getCurrentFeature();
        if (!feature) {
          console.log(chalk.red('No active feature.'));
          process.exit(1);
          return;
        }

        const position = parseDiffPosition(label);
        if (position === null) {
          console.log(
            chalk.red(`Invalid diff label: ${label}. Use format D1, D2, etc.`),
          );
          process.exit(1);
          return;
        }

        const targetDiff = getDiffByPosition(feature, position);
        if (!targetDiff) {
          console.log(
            chalk.red(`${diffLabel(position)} not found.`),
          );
          process.exit(1);
          return;
        }

        // Save undo entry with current HEAD
        const headBefore = git.getHeadSha();
        saveUndoEntry({
          action: 'diff-edit',
          timestamp: new Date().toISOString(),
          refBefore: headBefore,
          description: `Edit ${diffLabel(position)}`,
          data: {
            uuid: targetDiff.uuid,
            featureBranch: feature.branch,
          },
        });

        // Set editing state
        setEditingDiff(targetDiff.uuid);

        // Hard reset to the diff's commit so user sees that state
        // We'll cherry-pick the rest back when they run `devpod diff`
        const diffs = loadDiffsForFeature(feature);
        const aboveDiffs = diffs
          .filter((d) => d.position > position)
          .sort((a, b) => a.position - b.position);

        // Only reset if there are diffs above (otherwise already at the right commit)
        if (aboveDiffs.length > 0) {
          // Use execSync directly to do a hard reset
          const { execSync } = require('node:child_process');
          execSync(`git reset --hard ${targetDiff.commit}`, {
            stdio: 'pipe',
            encoding: 'utf-8',
          });
        }

        console.log(
          `${chalk.green('\u2713')} Editing ${diffLabel(position)}: ${targetDiff.title}`,
        );
        console.log(
          chalk.dim('  Make your changes, then run: devpod diff'),
        );
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });

  // devpod diff check [D1]
  diff
    .command('check')
    .description('Run CI checks for a diff')
    .argument('[label]', 'Diff label (e.g., D1). Defaults to latest.')
    .action(async (label?: string) => {
      try {
        const feature = getCurrentFeature();
        if (!feature) {
          console.log(chalk.red('No active feature.'));
          process.exit(1);
          return;
        }

        const diffs = loadDiffsForFeature(feature);
        if (diffs.length === 0) {
          console.log(chalk.dim('No diffs to check.'));
          return;
        }

        let targetDiff: DiffData;
        if (label) {
          const position = parseDiffPosition(label);
          if (position === null) {
            console.log(
              chalk.red(`Invalid diff label: ${label}. Use format D1, D2, etc.`),
            );
            process.exit(1);
            return;
          }
          const found = getDiffByPosition(feature, position);
          if (!found) {
            console.log(chalk.red(`${diffLabel(position)} not found.`));
            process.exit(1);
            return;
          }
          targetDiff = found;
        } else {
          targetDiff = diffs[diffs.length - 1]!;
        }

        // Check if runner is available
        const isUp = await api.ping();
        if (!isUp) {
          console.log(
            chalk.red('Runner is not available. Start it with: devpod runner start'),
          );
          process.exit(1);
          return;
        }

        const spinner = ora(
          `Running checks for ${diffLabel(targetDiff.position)}...`,
        ).start();

        try {
          const run = await api.post<{ id: string; status: string }>(
            '/api/runs',
            {
              workflow: 'pull_request',
              ref: feature.branch,
              inputs: { diff: targetDiff.uuid },
            },
          );

          spinner.text = `Checks running (${run.id})...`;

          // Stream results
          await new Promise<void>((resolve) => {
            let completed = false;

            const stop = api.sseStream(
              '/api/events',
              (type: string, data: unknown) => {
                const event = data as {
                  runId: string;
                  status?: string;
                  log?: string;
                  stepName?: string;
                  jobName?: string;
                };
                if (event.runId !== run.id) return;

                switch (type) {
                  case 'step.log':
                    if (event.log) {
                      spinner.stop();
                      const prefix = chalk.dim('  \u25b8 ');
                      for (const line of event.log.split('\n')) {
                        console.log(`${prefix}${line}`);
                      }
                      spinner.start();
                    }
                    break;
                  case 'run.completed': {
                    completed = true;
                    spinner.stop();
                    const status = event.status || 'success';
                    const passed = status === 'success';
                    targetDiff.ci = passed ? 'passed' : 'failed';
                    saveDiff(targetDiff);

                    if (passed) {
                      console.log(
                        `${chalk.green('\u2713')} ${diffLabel(targetDiff.position)} checks passed`,
                      );
                    } else {
                      console.log(
                        `${chalk.red('\u2717')} ${diffLabel(targetDiff.position)} checks failed`,
                      );
                    }
                    stop();
                    resolve();
                    break;
                  }
                }
              },
            );

            // Timeout after 30 minutes
            setTimeout(() => {
              if (!completed) {
                spinner.stop();
                console.log(chalk.yellow('Check timed out.'));
                targetDiff.ci = 'failed';
                saveDiff(targetDiff);
                stop();
                resolve();
              }
            }, 30 * 60 * 1000);
          });
        } catch (err) {
          spinner.fail('Failed to run checks');
          console.error(errorMessage(err));
          process.exit(1);
        }
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });
}
