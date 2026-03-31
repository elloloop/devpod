import { Command } from 'commander';
import chalk from 'chalk';
import * as git from '../git';
import {
  ensureDevpodDir,
  loadConfig,
  saveFeature,
  slugify,
  getCurrentFeature,
  saveUndoEntry,
  type ChangeType,
  type FeatureData,
} from '../workspace';
import {
  errorMessage,
  contextLine,
  nextStepHint,
  featureTypePrefix,
} from '../format';

function autoSaveChanges(cwd?: string): void {
  if (!git.isClean(cwd)) {
    git.stageAll(cwd);
    git.commit('WIP: auto-save before switching context', cwd);
  }
}

function startFeature(
  name: string,
  type: ChangeType,
): void {
  // Auto-save uncommitted changes on current feature
  autoSaveChanges();

  const config = loadConfig();
  const slug = slugify(name);
  const prefix = type === 'unknown' ? 'feature' : type;
  const branch = `${prefix}/${slug}`;

  // Fetch latest and create branch
  git.fetchMain();
  git.createBranch(branch, config.defaultBranch);

  // Create feature data
  const feature: FeatureData = {
    name,
    type,
    slug,
    branch,
    created: new Date().toISOString(),
    diffs: [],
    status: 'active',
  };

  ensureDevpodDir();
  saveFeature(feature);

  console.log(
    `${chalk.green('\u2713')} Started ${featureTypePrefix(type)}: ${chalk.bold(name)}`,
  );
  console.log(contextLine(feature, null));
  console.log(nextStepHint('feature'));
}

export function registerFeatureCommands(program: Command): void {
  program
    .command('feature')
    .description('Start a new feature')
    .argument('<name>', 'Feature name')
    .action(async (name: string) => {
      try {
        startFeature(name, 'feature');
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });

  program
    .command('fix')
    .description('Start a bug fix')
    .argument('<name>', 'Fix description')
    .action(async (name: string) => {
      try {
        startFeature(name, 'fix');
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });

  program
    .command('docs')
    .description('Start a documentation change')
    .argument('<name>', 'Docs description')
    .action(async (name: string) => {
      try {
        startFeature(name, 'docs');
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });

  program
    .command('chore')
    .description('Start a chore (tooling, deps, config)')
    .argument('<name>', 'Chore description')
    .action(async (name: string) => {
      try {
        startFeature(name, 'chore');
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });

  program
    .command('start')
    .description('Start working on something (type detected later)')
    .argument('<name>', 'Description of what you are working on')
    .action(async (name: string) => {
      try {
        startFeature(name, 'unknown');
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });
}
