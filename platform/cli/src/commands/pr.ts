import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { execSync } from 'node:child_process';
import * as api from '../api';
import { statusIcon, errorMessage } from '../format';
import {
  loadStack,
  saveStack,
  findEntryForBranch,
  getCurrentBranch,
  getDefaultBranch,
} from '../stack';
import { registerStackCommands } from './stack';

interface GhPr {
  number: number;
  title: string;
  headRefName: string;
  baseRefName: string;
  state: string;
  url: string;
  statusCheckRollup?: { state: string }[];
  additions?: number;
  deletions?: number;
  changedFiles?: number;
  body?: string;
  comments?: { body: string; author: { login: string }; createdAt: string }[];
}

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

function ciStatusLabel(pr: GhPr): string {
  if (!pr.statusCheckRollup || pr.statusCheckRollup.length === 0) {
    return chalk.dim('\u25cb No CI');
  }
  const states = pr.statusCheckRollup.map((c) => c.state);
  if (states.every((s) => s === 'SUCCESS')) {
    return chalk.green('\u2713 CI passed');
  }
  if (states.some((s) => s === 'FAILURE' || s === 'ERROR')) {
    return chalk.red('\u2717 CI failed');
  }
  if (states.some((s) => s === 'PENDING' || s === 'EXPECTED')) {
    return chalk.yellow('\u23f3 CI running');
  }
  return chalk.dim('\u25cb CI unknown');
}

function getPrForCurrentBranch(): number | null {
  const branch = getCurrentBranch();
  // Check stack first
  const entry = findEntryForBranch(branch);
  if (entry?.pr) return entry.pr;
  // Ask gh
  const result = execQuiet(
    `gh pr view --json number --jq .number`,
  );
  if (result) {
    const num = parseInt(result, 10);
    if (!isNaN(num)) return num;
  }
  return null;
}

export function registerPrCommand(program: Command): void {
  const pr = program
    .command('pr')
    .description('Manage pull requests with stacked PR support');

  // pr create
  pr.command('create')
    .description('Create a new PR from the current branch')
    .option('-t, --title <title>', 'PR title')
    .option('-b, --base <branch>', 'Base branch')
    .action(async (opts: { title?: string; base?: string }) => {
      try {
        const branch = getCurrentBranch();
        const defaultBranch = getDefaultBranch();

        // Determine base branch
        let base = opts.base;
        const stack = loadStack();
        const entry = findEntryForBranch(branch);

        if (!base) {
          if (entry) {
            base = entry.parent;
          } else {
            // If there are stack entries and current branch is not in stack,
            // check if we branched off a stacked branch
            const lastStackBranch =
              stack.stack.length > 0
                ? stack.stack[stack.stack.length - 1]!.branch
                : null;
            if (
              lastStackBranch &&
              lastStackBranch !== branch
            ) {
              // Check if current branch is a descendant of the last stack branch
              const mergeBase = execQuiet(
                `git merge-base ${lastStackBranch} ${branch}`,
              );
              const lastTip = execQuiet(
                `git rev-parse ${lastStackBranch}`,
              );
              if (mergeBase && lastTip && mergeBase === lastTip) {
                base = lastStackBranch;
              }
            }
            if (!base) {
              base = defaultBranch;
            }
          }
        }

        // Determine title
        let title = opts.title;
        if (!title) {
          title = exec('git log -1 --format=%s');
        }

        // Push branch
        const spinner = ora('Pushing branch...').start();
        try {
          execSync(`git push -u origin ${branch}`, {
            stdio: 'pipe',
          });
          spinner.succeed('Branch pushed');
        } catch {
          spinner.warn('Push failed or branch already up to date');
        }

        // Generate body from commit messages
        const commits = execQuiet(
          `git log ${base}..${branch} --format="- %s"`,
        );
        const body = commits
          ? `## Changes\n\n${commits}`
          : '';

        // Create PR
        const createSpinner = ora('Creating PR...').start();
        const prUrl = exec(
          `gh pr create --base ${base} --title ${JSON.stringify(title)} --body ${JSON.stringify(body)}`,
        );
        createSpinner.succeed('PR created');

        // Get PR number
        const prJson = exec(
          `gh pr view --json number --jq .number`,
        );
        const prNumber = parseInt(prJson, 10);

        // Update stack
        if (entry) {
          entry.pr = prNumber;
          entry.title = title;
          saveStack(stack);
        } else if (base !== defaultBranch || stack.stack.length > 0) {
          // Add to stack if it has a non-default base or there's already a stack
          stack.stack.push({
            branch,
            pr: prNumber,
            title,
            parent: base,
          });
          saveStack(stack);
        }

        console.log(`\n${chalk.green('\u2713')} ${chalk.bold(`#${prNumber}`)} ${title}`);
        console.log(`  ${chalk.cyan(prUrl)}`);
        if (base !== defaultBranch) {
          console.log(`  ${chalk.dim(`Stacked on ${base}`)}`);
        }
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });

  // pr list
  pr.command('list')
    .description('List PRs, showing stack relationships')
    .action(async () => {
      try {
        const prData = exec(
          'gh pr list --json number,title,headRefName,baseRefName,statusCheckRollup --limit 50',
        );
        const prs: GhPr[] = JSON.parse(prData);

        if (prs.length === 0) {
          console.log(chalk.dim('No open PRs.'));
          return;
        }

        const stack = loadStack();
        const stackBranches = new Set(stack.stack.map((e) => e.branch));

        // Separate stacked and non-stacked PRs
        const stackedPrs: GhPr[] = [];
        const otherPrs: GhPr[] = [];

        for (const p of prs) {
          if (stackBranches.has(p.headRefName)) {
            stackedPrs.push(p);
          } else {
            otherPrs.push(p);
          }
        }

        // Render stacked PRs grouped by stack
        if (stack.stack.length > 0 && stackedPrs.length > 0) {
          // Order stacked PRs according to stack order
          const orderedStack = stack.stack.filter((e) =>
            stackedPrs.some((p) => p.headRefName === e.branch),
          );

          if (orderedStack.length > 0) {
            console.log(
              chalk.bold(`Stack (${orderedStack.length} PRs)`),
            );

            for (let i = 0; i < orderedStack.length; i++) {
              const entry = orderedStack[i]!;
              const ghPr = stackedPrs.find(
                (p) => p.headRefName === entry.branch,
              );
              if (!ghPr) continue;

              const ci = ciStatusLabel(ghPr);
              const baseLabel =
                entry.parent === getDefaultBranch()
                  ? entry.parent
                  : `#${stack.stack.find((e) => e.branch === entry.parent)?.pr || entry.parent}`;

              let prefix: string;
              if (orderedStack.length === 1) {
                prefix = '  \u2500';
              } else if (i === 0) {
                prefix = '  \u250c';
              } else if (i === orderedStack.length - 1) {
                prefix = '  \u2514';
              } else {
                prefix = '  \u251c';
              }

              console.log(
                `${prefix} ${chalk.cyan(`#${ghPr.number}`)} ${ghPr.title}  ${ci}  ${chalk.dim(`\u2190 ${baseLabel}`)}`,
              );
            }
            console.log();
          }
        }

        // Render other PRs
        if (otherPrs.length > 0) {
          if (stackedPrs.length > 0) {
            console.log(chalk.bold('Other PRs:'));
          }
          for (const p of otherPrs) {
            const ci = ciStatusLabel(p);
            console.log(
              `  ${chalk.cyan(`#${p.number}`)} ${p.title}  ${ci}  ${chalk.dim(`\u2190 ${p.baseRefName}`)}`,
            );
          }
        }
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });

  // pr view
  pr.command('view')
    .description("View a PR's details")
    .argument('[number]', 'PR number')
    .action(async (number?: string) => {
      try {
        let prNum: number | null = null;
        if (number) {
          prNum = parseInt(number, 10);
        } else {
          prNum = getPrForCurrentBranch();
        }

        if (!prNum) {
          console.error(
            chalk.red('No PR number provided and no PR found for current branch'),
          );
          process.exit(1);
          return;
        }

        const prJson = exec(
          `gh pr view ${prNum} --json number,title,headRefName,baseRefName,state,url,additions,deletions,changedFiles,body,statusCheckRollup,comments`,
        );
        const prData: GhPr = JSON.parse(prJson);

        console.log(
          `${chalk.bold(`#${prData.number}`)} ${prData.title}`,
        );
        console.log(`${chalk.dim('URL:')} ${chalk.cyan(prData.url)}`);
        console.log(
          `${chalk.dim('State:')} ${prData.state === 'OPEN' ? chalk.green('Open') : prData.state === 'MERGED' ? chalk.magenta('Merged') : chalk.red('Closed')}`,
        );
        console.log(
          `${chalk.dim('Base:')} ${prData.baseRefName} ${chalk.dim('\u2190')} ${prData.headRefName}`,
        );

        // Diff stats
        if (
          prData.additions !== undefined ||
          prData.deletions !== undefined
        ) {
          const adds = prData.additions || 0;
          const dels = prData.deletions || 0;
          const files = prData.changedFiles || 0;
          console.log(
            `${chalk.dim('Changes:')} ${chalk.green(`+${adds}`)} ${chalk.red(`-${dels}`)} across ${files} file${files !== 1 ? 's' : ''}`,
          );
        }

        // CI status
        const ci = ciStatusLabel(prData);
        console.log(`${chalk.dim('CI:')} ${ci}`);

        // Stack info
        const entry = findEntryForBranch(prData.headRefName);
        if (entry) {
          const stack = loadStack();
          const children = stack.stack.filter(
            (e) => e.parent === entry.branch,
          );
          console.log(`${chalk.dim('Stack parent:')} ${entry.parent}`);
          if (children.length > 0) {
            console.log(
              `${chalk.dim('Stack children:')} ${children.map((c) => c.branch).join(', ')}`,
            );
          }
        }

        // Body
        if (prData.body) {
          console.log();
          console.log(prData.body);
        }

        // Comments
        if (prData.comments && prData.comments.length > 0) {
          console.log();
          console.log(chalk.bold(`Comments (${prData.comments.length}):`));
          for (const comment of prData.comments) {
            console.log(
              `  ${chalk.cyan(comment.author.login)} ${chalk.dim(comment.createdAt)}`,
            );
            const lines = comment.body.split('\n');
            for (const line of lines) {
              console.log(`    ${line}`);
            }
            console.log();
          }
        }
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });

  // pr check
  pr.command('check')
    .description('Run CI checks locally for a PR')
    .argument('[number]', 'PR number')
    .action(async (number?: string) => {
      try {
        let prNum: number | null = null;
        if (number) {
          prNum = parseInt(number, 10);
        } else {
          prNum = getPrForCurrentBranch();
        }

        if (!prNum) {
          console.error(
            chalk.red('No PR number provided and no PR found for current branch'),
          );
          process.exit(1);
          return;
        }

        // Get PR head branch
        const prJson = exec(
          `gh pr view ${prNum} --json headRefName --jq .headRefName`,
        );
        const headBranch = prJson;

        console.log(
          `${chalk.blue('\u25b6')} Running CI checks for PR #${prNum} (${headBranch})`,
        );

        // Trigger run via local runner API
        let run: { id: string; status: string };
        const spinner = ora('Triggering CI run...').start();
        try {
          run = await api.post<{ id: string; status: string }>(
            '/api/runs',
            {
              workflow: 'pull_request',
              ref: headBranch,
              inputs: { pr: String(prNum) },
            },
          );
          spinner.succeed(`Run started: ${run.id}`);
        } catch (err) {
          spinner.fail('Failed to trigger CI run');
          console.error(errorMessage(err));
          process.exit(1);
          return;
        }

        // Stream events
        let finalStatus = 'unknown';
        await new Promise<void>((resolve) => {
          let completed = false;

          const stop = api.sseStream(
            '/api/events',
            (type: string, data: unknown) => {
              const event = data as {
                runId: string;
                jobName?: string;
                stepName?: string;
                status?: string;
                log?: string;
              };
              if (event.runId !== run.id) return;

              switch (type) {
                case 'step.log':
                  if (event.log) {
                    const prefix = chalk.dim('  \u25b8 ');
                    for (const line of event.log.split('\n')) {
                      console.log(`${prefix}${line}`);
                    }
                  }
                  break;
                case 'step.completed': {
                  const icon = statusIcon(
                    event.status || 'success',
                  );
                  console.log(
                    `  ${icon} ${event.stepName || 'Step'}`,
                  );
                  break;
                }
                case 'job.completed': {
                  const icon = statusIcon(
                    event.status || 'success',
                  );
                  console.log(
                    `${icon} Job: ${event.jobName || 'unknown'} (${event.status})`,
                  );
                  console.log();
                  break;
                }
                case 'run.completed': {
                  completed = true;
                  finalStatus = event.status || 'success';
                  const runIcon = statusIcon(finalStatus);
                  console.log(
                    `${runIcon} CI run completed: ${finalStatus}`,
                  );
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
              console.error(
                chalk.yellow('\nCI run timed out'),
              );
              finalStatus = 'timeout';
              stop();
              resolve();
            }
          }, 30 * 60 * 1000);
        });

        // Post results as a comment on the PR
        const passed = finalStatus === 'success';
        const commentBody = passed
          ? `## CI Results\n\nAll checks passed.`
          : `## CI Results\n\nCI checks **failed** (status: ${finalStatus}).`;

        try {
          execSync(
            `gh pr comment ${prNum} --body ${JSON.stringify(commentBody)}`,
            { stdio: 'pipe' },
          );
          console.log(chalk.dim('Posted results to PR'));
        } catch {
          console.log(
            chalk.dim('Could not post comment to PR'),
          );
        }

        if (!passed) {
          process.exit(1);
        }
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });

  // pr merge
  pr.command('merge')
    .description('Squash merge a PR')
    .argument('[number]', 'PR number')
    .option('--delete-branch', 'Delete the branch after merge', true)
    .action(
      async (
        number?: string,
        opts?: { deleteBranch?: boolean },
      ) => {
        try {
          let prNum: number | null = null;
          if (number) {
            prNum = parseInt(number, 10);
          } else {
            prNum = getPrForCurrentBranch();
          }

          if (!prNum) {
            console.error(
              chalk.red(
                'No PR number provided and no PR found for current branch',
              ),
            );
            process.exit(1);
            return;
          }

          // Check CI status
          const prJson = exec(
            `gh pr view ${prNum} --json statusCheckRollup,headRefName,baseRefName`,
          );
          const prData: GhPr = JSON.parse(prJson);

          if (
            prData.statusCheckRollup &&
            prData.statusCheckRollup.length > 0
          ) {
            const hasFailure = prData.statusCheckRollup.some(
              (c) => c.state === 'FAILURE' || c.state === 'ERROR',
            );
            const allPassed = prData.statusCheckRollup.every(
              (c) => c.state === 'SUCCESS',
            );
            if (hasFailure) {
              console.log(
                chalk.yellow(
                  '\u26a0  CI checks have failed. Proceeding anyway...',
                ),
              );
            } else if (!allPassed) {
              console.log(
                chalk.yellow(
                  '\u26a0  CI checks have not all passed yet. Proceeding anyway...',
                ),
              );
            }
          }

          // Squash merge
          const spinner = ora(
            `Squash merging PR #${prNum}...`,
          ).start();
          const deleteFlag =
            opts?.deleteBranch !== false ? ' --delete-branch' : '';
          try {
            execSync(
              `gh pr merge ${prNum} --squash${deleteFlag}`,
              { stdio: 'pipe' },
            );
            spinner.succeed(`PR #${prNum} squash merged`);
          } catch (mergeErr) {
            spinner.fail('Merge failed');
            console.error(errorMessage(mergeErr));
            process.exit(1);
            return;
          }

          // Handle stack rebase if this PR is in a stack
          const stack = loadStack();
          const mergedEntry = stack.stack.find(
            (e) => e.pr === prNum,
          );

          if (mergedEntry) {
            const defaultBranch = getDefaultBranch();
            const mergedIdx = stack.stack.indexOf(mergedEntry);

            // Find children that need rebasing
            const childEntries: typeof stack.stack = [];
            let currentParent = mergedEntry.branch;
            for (
              let i = mergedIdx + 1;
              i < stack.stack.length;
              i++
            ) {
              const child = stack.stack[i]!;
              if (child.parent === currentParent) {
                childEntries.push(child);
                currentParent = child.branch;
              }
            }

            if (childEntries.length > 0) {
              console.log();
              console.log(
                chalk.bold('Rebasing remaining stack...'),
              );

              // Fetch latest
              execSync('git fetch origin', { stdio: 'pipe' });
              execSync(`git checkout ${defaultBranch}`, {
                stdio: 'pipe',
              });
              execSync(`git pull origin ${defaultBranch}`, {
                stdio: 'pipe',
              });

              // The new base for the first child is the default branch
              let newBase = defaultBranch;

              for (const child of childEntries) {
                const rebaseSpinner = ora(
                  `Rebasing ${child.branch}...`,
                ).start();
                try {
                  execSync(
                    `git checkout ${child.branch}`,
                    { stdio: 'pipe' },
                  );
                  execSync(`git rebase ${newBase}`, {
                    stdio: 'pipe',
                  });
                  execSync(
                    `git push --force-with-lease`,
                    { stdio: 'pipe' },
                  );

                  // Update PR base on GitHub
                  if (child.pr) {
                    execSync(
                      `gh pr edit ${child.pr} --base ${newBase}`,
                      { stdio: 'pipe' },
                    );
                  }

                  // Update stack entry
                  child.parent = newBase;
                  rebaseSpinner.succeed(
                    `Rebased ${child.branch} onto ${newBase}`,
                  );
                  newBase = child.branch;
                } catch (rebaseErr) {
                  rebaseSpinner.fail(
                    `Rebase conflict on ${child.branch}`,
                  );
                  console.error(
                    chalk.red(
                      `\nRebase conflict detected on ${child.branch}.`,
                    ),
                  );
                  console.log(
                    chalk.dim(
                      'Resolve conflicts manually, then run:',
                    ),
                  );
                  console.log(
                    chalk.dim(
                      '  git rebase --continue && git push --force-with-lease',
                    ),
                  );
                  // Save partial progress
                  stack.stack = stack.stack.filter(
                    (e) => e !== mergedEntry,
                  );
                  saveStack(stack);
                  process.exit(1);
                  return;
                }
              }

              // Remove merged entry from stack
              stack.stack = stack.stack.filter(
                (e) => e !== mergedEntry,
              );
              saveStack(stack);
            } else {
              // No children, just remove from stack
              stack.stack = stack.stack.filter(
                (e) => e !== mergedEntry,
              );
              saveStack(stack);
            }

            // Switch back to default branch
            try {
              execSync(`git checkout ${defaultBranch}`, {
                stdio: 'pipe',
              });
              execSync(`git pull origin ${defaultBranch}`, {
                stdio: 'pipe',
              });
            } catch {
              // best effort
            }
          }

          console.log(
            `\n${chalk.green('\u2713')} PR #${prNum} merged successfully`,
          );
        } catch (err) {
          console.error(errorMessage(err));
          process.exit(1);
        }
      },
    );

  // Register stack subcommands under pr
  registerStackCommands(pr);
}
