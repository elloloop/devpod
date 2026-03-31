import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { execSync } from 'node:child_process';
import {
  loadStack,
  saveStack,
  getCurrentBranch,
  getDefaultBranch,
} from '../stack';
import { errorMessage } from '../format';

function exec(cmd: string): string {
  return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' }).trim();
}

function execQuiet(cmd: string): string | null {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' }).trim();
  } catch {
    return null;
  }
}

export function registerStackCommands(prCommand: Command): void {
  const stack = prCommand
    .command('stack')
    .description('Manage stacked PRs');

  // Default action: show stack state
  stack.action(async () => {
    try {
      const data = loadStack();

      if (data.stack.length === 0) {
        console.log(chalk.dim('No active stack.'));
        console.log(
          chalk.dim('Start one with: devpod pr stack new <name>'),
        );
        return;
      }

      const currentBranch = getCurrentBranch();

      console.log(chalk.bold(`Stack (${data.stack.length} PRs):`));

      for (let i = 0; i < data.stack.length; i++) {
        const entry = data.stack[i]!;
        const prLabel = entry.pr ? `(#${entry.pr})` : '(no PR)';
        const parentLabel = entry.parent;

        // Check if merged
        let status: string;
        if (entry.pr) {
          const stateResult = execQuiet(
            `gh pr view ${entry.pr} --json state --jq .state`,
          );
          if (stateResult === 'MERGED') {
            status = chalk.magenta('\u2713 merged');
          } else if (stateResult === 'CLOSED') {
            status = chalk.red('\u2717 closed');
          } else {
            status = chalk.green('\u25cb open');
          }
        } else {
          status = chalk.dim('\u25cb no PR');
        }

        const isCurrent = entry.branch === currentBranch;
        const branchDisplay = isCurrent
          ? chalk.bold.cyan(entry.branch)
          : entry.branch;

        const marker = isCurrent ? chalk.cyan(' \u25c0 ') : '';

        console.log(
          `  ${i + 1}. ${branchDisplay} ${chalk.dim(prLabel)}  ${chalk.dim(`\u2190 ${parentLabel}`)}  ${status}${marker}`,
        );
      }

      console.log();
      console.log(
        `${chalk.dim('Current branch:')} ${currentBranch}`,
      );
    } catch (err) {
      console.error(errorMessage(err));
      process.exit(1);
    }
  });

  // stack new <name>
  stack
    .command('new')
    .description('Start a new stacked branch from the current branch')
    .argument('<name>', 'Branch name (will be prefixed with pr/)')
    .action(async (name: string) => {
      try {
        const currentBranch = getCurrentBranch();
        const branchName = `pr/${name}`;

        // Create the branch
        const spinner = ora(
          `Creating branch ${branchName}...`,
        ).start();
        try {
          execSync(`git checkout -b ${branchName}`, {
            stdio: 'pipe',
          });
          spinner.succeed(`Created branch ${chalk.cyan(branchName)}`);
        } catch {
          spinner.fail(`Failed to create branch ${branchName}`);
          console.error(
            chalk.red(
              `Branch ${branchName} may already exist. Delete it first or choose a different name.`,
            ),
          );
          process.exit(1);
          return;
        }

        // Add to stack
        const data = loadStack();
        data.stack.push({
          branch: branchName,
          title: name.replace(/-/g, ' '),
          parent: currentBranch,
        });
        saveStack(data);

        console.log();
        console.log(
          `${chalk.green('\u2713')} Added to stack: ${chalk.cyan(branchName)} ${chalk.dim(`\u2190 ${currentBranch}`)}`,
        );
        console.log();
        console.log(chalk.dim('Next steps:'));
        console.log(
          chalk.dim(
            '  1. Make your changes and commit',
          ),
        );
        console.log(
          chalk.dim(
            '  2. devpod pr create --title "Your PR title"',
          ),
        );
        console.log(
          chalk.dim(
            '  3. devpod pr stack new <next-name>  (to continue the stack)',
          ),
        );
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });

  // stack rebase
  stack
    .command('rebase')
    .description('Rebase the entire stack onto latest main')
    .action(async () => {
      try {
        const data = loadStack();

        if (data.stack.length === 0) {
          console.log(chalk.dim('No active stack to rebase.'));
          return;
        }

        const defaultBranch = getDefaultBranch();
        const originalBranch = getCurrentBranch();

        // Fetch latest
        const fetchSpinner = ora('Fetching latest...').start();
        execSync(`git fetch origin ${defaultBranch}`, {
          stdio: 'pipe',
        });
        fetchSpinner.succeed('Fetched latest');

        // Rebase each branch in order
        for (let i = 0; i < data.stack.length; i++) {
          const entry = data.stack[i]!;
          const base =
            i === 0
              ? `origin/${defaultBranch}`
              : data.stack[i - 1]!.branch;

          const spinner = ora(
            `Rebasing ${entry.branch} onto ${base}...`,
          ).start();

          try {
            execSync(`git checkout ${entry.branch}`, {
              stdio: 'pipe',
            });
            execSync(`git rebase ${base}`, {
              stdio: 'pipe',
            });
            execSync(`git push --force-with-lease`, {
              stdio: 'pipe',
            });
            spinner.succeed(
              `Rebased ${chalk.cyan(entry.branch)} onto ${base}`,
            );
          } catch {
            spinner.fail(
              `Rebase conflict on ${entry.branch}`,
            );
            console.error(
              chalk.red(
                `\nRebase conflict detected on ${entry.branch}.`,
              ),
            );
            console.log(chalk.dim('Resolve conflicts, then run:'));
            console.log(
              chalk.dim(
                '  git rebase --continue && git push --force-with-lease',
              ),
            );
            console.log(
              chalk.dim(
                '  devpod pr stack rebase  (to continue rebasing the rest)',
              ),
            );
            process.exit(1);
            return;
          }
        }

        // Update parents for first entry
        if (
          data.stack.length > 0 &&
          data.stack[0]!.parent !== defaultBranch
        ) {
          data.stack[0]!.parent = defaultBranch;
          saveStack(data);
        }

        // Switch back to original branch
        try {
          execSync(`git checkout ${originalBranch}`, {
            stdio: 'pipe',
          });
        } catch {
          // best effort
        }

        console.log();
        console.log(
          chalk.green('\u2713') +
            ` Stack rebased (${data.stack.length} branches)`,
        );
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });

  // stack submit
  stack
    .command('submit')
    .description('Create/update PRs for the entire stack')
    .action(async () => {
      try {
        const data = loadStack();

        if (data.stack.length === 0) {
          console.log(chalk.dim('No active stack.'));
          return;
        }

        const originalBranch = getCurrentBranch();
        let updated = false;

        console.log(
          chalk.bold(
            `Submitting stack (${data.stack.length} branches)...`,
          ),
        );
        console.log();

        for (const entry of data.stack) {
          const base = entry.parent;

          // Push branch
          const pushSpinner = ora(
            `Pushing ${entry.branch}...`,
          ).start();
          try {
            execSync(
              `git push -u origin ${entry.branch}`,
              { stdio: 'pipe' },
            );
            pushSpinner.succeed(`Pushed ${entry.branch}`);
          } catch {
            // May already be up to date
            pushSpinner.warn(
              `Push for ${entry.branch} (already up to date or failed)`,
            );
          }

          if (!entry.pr) {
            // Create PR
            const createSpinner = ora(
              `Creating PR for ${entry.branch}...`,
            ).start();

            // Generate body from commits
            const commits = execQuiet(
              `git log ${base}..${entry.branch} --format="- %s"`,
            );
            const body = commits
              ? `## Changes\n\n${commits}`
              : '';

            try {
              const url = exec(
                `gh pr create --head ${entry.branch} --base ${base} --title ${JSON.stringify(entry.title)} --body ${JSON.stringify(body)}`,
              );

              // Get PR number
              const prNumStr = execQuiet(
                `gh pr view ${entry.branch} --json number --jq .number`,
              );
              if (prNumStr) {
                entry.pr = parseInt(prNumStr, 10);
              }

              createSpinner.succeed(
                `Created PR for ${entry.branch}: ${chalk.cyan(url)}`,
              );
              updated = true;
            } catch (createErr) {
              createSpinner.fail(
                `Failed to create PR for ${entry.branch}`,
              );
              console.error(errorMessage(createErr));
            }
          } else {
            // PR already exists, ensure base is correct
            try {
              execSync(
                `gh pr edit ${entry.pr} --base ${base}`,
                { stdio: 'pipe' },
              );
              console.log(
                `  ${chalk.green('\u2713')} PR #${entry.pr} (${entry.branch}) updated`,
              );
            } catch {
              console.log(
                `  ${chalk.dim('\u2013')} PR #${entry.pr} (${entry.branch}) unchanged`,
              );
            }
          }
        }

        if (updated) {
          saveStack(data);
        }

        // Switch back
        try {
          execSync(`git checkout ${originalBranch}`, {
            stdio: 'pipe',
          });
        } catch {
          // best effort
        }

        console.log();
        console.log(chalk.bold('Stack PRs:'));
        for (const entry of data.stack) {
          const prLabel = entry.pr
            ? chalk.cyan(`#${entry.pr}`)
            : chalk.dim('(no PR)');
          console.log(
            `  ${prLabel} ${entry.title} ${chalk.dim(`\u2190 ${entry.parent}`)}`,
          );
        }
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });
}
