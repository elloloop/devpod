import { Command } from 'commander';
import chalk from 'chalk';
import * as readline from 'node:readline';
import { execSync } from 'node:child_process';
import * as git from '../git';
import {
  getCurrentFeature,
  getNextDiffPosition,
  generateDiffUuid,
  saveDiff,
  saveFeature,
  saveUndoEntry,
  type DiffData,
  type ChangeType,
} from '../workspace';
import {
  generateDiffMessage,
  isLLMAvailable,
  generateFallbackMessage,
} from '../llm';
import {
  errorMessage,
  diffLabel,
  featureTypePrefix,
  nextStepHint,
} from '../format';

interface SplitGroup {
  title: string;
  files: string[];
}

async function askConfirmation(prompt: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized === '' || normalized === 'y' || normalized === 'yes');
    });
  });
}

async function splitWithLLM(
  diffContent: string,
  files: string[],
  type: ChangeType,
  scope: string,
): Promise<SplitGroup[]> {
  // For split, we ask the LLM to group files into logical diffs
  // We use generateDiffMessage for each group after splitting
  // The grouping itself is a heuristic based on file paths

  // Simple heuristic grouping by directory/module
  const groups = new Map<string, string[]>();

  for (const file of files) {
    const parts = file.split('/');
    // Group by the first meaningful directory
    let key: string;
    if (parts.length <= 1) {
      key = 'root';
    } else if (parts.length <= 2) {
      key = parts[0]!;
    } else {
      key = `${parts[0]}/${parts[1]}`;
    }

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(file);
  }

  // Convert to split groups with titles
  const result: SplitGroup[] = [];
  let position = 1;

  for (const [area, areaFiles] of groups) {
    // Try to generate a title for this group
    let title: string;
    if (isLLMAvailable()) {
      try {
        const msg = await generateDiffMessage(diffContent, type , scope);
        title = msg.title;
      } catch {
        const msg = generateFallbackMessage(areaFiles, type , scope);
        title = msg.title;
      }
    } else {
      const prefix = featureTypePrefix(type);
      title = `${prefix}(${scope}): update ${area}`;
    }

    result.push({ title, files: areaFiles });
    position++;
  }

  return result;
}

export function registerSplitCommand(program: Command): void {
  program
    .command('split')
    .description('Split current changes into multiple diffs')
    .option('--preview', 'Preview the split without applying')
    .action(async (opts: { preview?: boolean }) => {
      try {
        if (!isLLMAvailable()) {
          console.log(
            chalk.red(
              'Split requires an LLM. Configure with: devpod config set llm.provider anthropic',
            ),
          );
          process.exit(1);
          return;
        }

        const feature = getCurrentFeature();
        if (!feature) {
          console.log(chalk.red('No active feature.'));
          console.log(
            chalk.dim('Start one with: devpod feature "name"'),
          );
          process.exit(1);
          return;
        }

        const changes = git.getChangedFiles();
        if (changes.length === 0) {
          console.log(chalk.dim('No changes to split.'));
          return;
        }

        const diffContent = git.getDiff();
        const changedFiles = changes.map((c) => c.path);
        const scope = feature.slug;

        console.log(
          chalk.dim(`Analyzing ${changedFiles.length} changed files...`),
        );

        const groups = await splitWithLLM(
          diffContent,
          changedFiles,
          feature.type,
          scope,
        );

        if (groups.length <= 1) {
          console.log(
            chalk.dim(
              'All changes belong in a single diff. Use "devpod diff" instead.',
            ),
          );
          return;
        }

        // Show proposed split
        const nextPos = getNextDiffPosition(feature);
        console.log();
        console.log(
          chalk.bold(`Suggested split (${groups.length} diffs):`),
        );
        for (let i = 0; i < groups.length; i++) {
          const group = groups[i]!;
          const label = diffLabel(nextPos + i);
          const fileList = group.files.join(', ');
          console.log(
            `  ${label}: ${group.title} \u2014 ${chalk.dim(fileList)}`,
          );
        }

        if (opts.preview) {
          return;
        }

        console.log();
        const confirmed = await askConfirmation('Apply? [Y/n] ');
        if (!confirmed) {
          console.log(chalk.dim('Cancelled.'));
          return;
        }

        // Save undo entry
        const headBefore = git.getHeadSha();
        saveUndoEntry({
          action: 'split',
          timestamp: new Date().toISOString(),
          refBefore: headBefore,
          description: `Split into ${groups.length} diffs`,
          data: { count: groups.length },
        });

        // Apply each group
        for (let i = 0; i < groups.length; i++) {
          const group = groups[i]!;
          const position = nextPos + i;

          // Stage only this group's files
          for (const file of group.files) {
            try {
              execSync(`git add ${JSON.stringify(file)}`, {
                stdio: 'pipe',
                encoding: 'utf-8',
              });
            } catch {
              // File may have been deleted
              try {
                execSync(`git add -A ${JSON.stringify(file)}`, {
                  stdio: 'pipe',
                  encoding: 'utf-8',
                });
              } catch {
                // skip
              }
            }
          }

          // Commit
          const commitSha = git.commit(group.title);

          // Get stats for this commit
          const stats = git.getDiffStats();

          // Create diff metadata
          const uuid = generateDiffUuid();
          const newDiff: DiffData = {
            uuid,
            feature: feature.slug,
            commit: commitSha,
            position,
            title: group.title,
            description: '',
            type: feature.type,
            files: group.files,
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
          feature.diffs.push(uuid);

          console.log(
            `  ${chalk.green('\u2713')} ${diffLabel(position)}: ${group.title}`,
          );
        }

        saveFeature(feature);

        console.log();
        console.log(
          `${chalk.green('\u2713')} Split into ${groups.length} diffs`,
        );
        console.log(nextStepHint('split'));
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });
}
