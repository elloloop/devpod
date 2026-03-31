import { Command } from 'commander';
import chalk from 'chalk';
import * as git from '../git';
import {
  listFeatures,
  getCurrentFeature,
  loadDiffsForFeature,
} from '../workspace';
import {
  errorMessage,
  contextLine,
  featureTypePrefix,
  diffLabel,
  diffStatusIcon,
  nextStepHint,
} from '../format';

function autoSaveChanges(cwd?: string): void {
  if (!git.isClean(cwd)) {
    git.stageAll(cwd);
    git.commit('WIP: auto-save before switching context', cwd);
  }
}

export function registerSwitchCommand(program: Command): void {
  program
    .command('switch')
    .description('Switch to a different feature')
    .argument('<query>', 'Feature name (partial match)')
    .action(async (query: string) => {
      try {
        const features = listFeatures();
        const q = query.toLowerCase();

        // Find matching features by partial name or slug
        const matches = features.filter(
          (f) =>
            f.name.toLowerCase().includes(q) ||
            f.slug.includes(q),
        );

        if (matches.length === 0) {
          console.log(
            chalk.red(`No feature matching "${query}" found.`),
          );
          if (features.length > 0) {
            console.log();
            console.log('Available features:');
            for (const f of features) {
              console.log(`  ${chalk.dim('\u2022')} ${f.name}`);
            }
          }
          process.exit(1);
          return;
        }

        if (matches.length > 1) {
          console.log(
            chalk.yellow(`Multiple features match "${query}":`),
          );
          for (const f of matches) {
            console.log(
              `  ${chalk.dim('\u2022')} ${f.name} ${chalk.dim(`(${featureTypePrefix(f.type)})`)}`,
            );
          }
          console.log();
          console.log('Be more specific to select one.');
          process.exit(1);
          return;
        }

        const target = matches[0]!;

        // Auto-save uncommitted changes on current feature
        autoSaveChanges();

        // Switch to the feature branch
        git.switchBranch(target.branch);

        // Show context for the new feature
        const diffs = loadDiffsForFeature(target);

        console.log(
          `${chalk.green('\u2713')} Switched to: ${chalk.bold(target.name)}`,
        );
        console.log(contextLine(target, diffs.length > 0 ? diffs[diffs.length - 1]! : null));

        if (diffs.length > 0) {
          const stackParts = diffs.map((d) => {
            const label = diffLabel(d.position);
            const icon = diffStatusIcon(d.status);
            return `${label} ${icon}`;
          });
          console.log(chalk.dim(`  Stack: ${stackParts.join(' \u2192 ')}`));
        }

        console.log(nextStepHint('switch'));
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });
}
