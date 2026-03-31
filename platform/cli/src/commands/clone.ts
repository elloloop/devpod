import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as git from '../git';
import { ensureDevpodDir } from '../workspace';
import { errorMessage, nextStepHint } from '../format';

export function registerCloneCommand(program: Command): void {
  program
    .command('clone')
    .description('Clone a repository and set up devpod')
    .argument('<repo>', 'Repository URL or owner/name')
    .action(async (repo: string) => {
      try {
        // Resolve repo URL
        let url = repo;
        if (!repo.includes('://') && !repo.startsWith('git@')) {
          url = `https://github.com/${repo}.git`;
        }

        // Derive directory name from URL
        const repoName = url
          .replace(/\.git$/, '')
          .split('/')
          .pop() || 'repo';

        console.log(`Cloning ${chalk.cyan(repo)}...`);

        git.clone(url, repoName);

        // Initialize .devpod workspace inside the cloned repo
        const fullPath = path.resolve(process.cwd(), repoName);
        ensureDevpodDir(fullPath);

        // Add .devpod/ to .git/info/exclude
        const excludePath = path.join(fullPath, '.git', 'info', 'exclude');
        try {
          const excludeDir = path.dirname(excludePath);
          if (!fs.existsSync(excludeDir)) {
            fs.mkdirSync(excludeDir, { recursive: true });
          }
          const existing = fs.existsSync(excludePath)
            ? fs.readFileSync(excludePath, 'utf-8')
            : '';
          if (!existing.includes('.devpod/')) {
            fs.writeFileSync(excludePath, existing.trimEnd() + '\n.devpod/\n');
          }
        } catch {
          // Non-fatal: exclude file couldn't be written
        }

        console.log(`${chalk.green('\u2713')} Cloned to ${chalk.bold(repoName)}`);
        console.log(chalk.dim(`  cd ${repoName}`));
        console.log(nextStepHint('clone'));
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });
}
