import { Command } from 'commander';
import { registerRunCommand } from './commands/run';
import { registerRunsCommand } from './commands/runs';
import { registerWorkflowsCommand } from './commands/workflows';
import { registerSecretCommand } from './commands/secret';
import { registerDashboardCommand } from './commands/dashboard';

// Workflow commands
import { registerCloneCommand } from './commands/clone';
import { registerFeatureCommands } from './commands/feature';
import { registerDiffCommand } from './commands/diff';
import { registerSyncCommand } from './commands/sync';
import { registerSwitchCommand } from './commands/switch';
import { registerSubmitCommand } from './commands/submit';
import { registerLandCommand } from './commands/land';
import { registerFeaturesCommand } from './commands/features';
import { registerContextCommand } from './commands/context';
import { registerStatusCommand } from './commands/status';
import { registerLogCommand } from './commands/log';
import { registerUndoCommand } from './commands/undo';
import { registerSplitCommand } from './commands/split';
import { registerConfigCommand } from './commands/config';
import { registerRunnerCommand } from './commands/runner';

const program = new Command();

program
  .name('devpod')
  .description('Developer workflow CLI')
  .version('1.0.0');

// ── Workflow commands ─────────────────────────────────────
registerCloneCommand(program);
registerFeatureCommands(program);   // feature, fix, docs, chore, start
registerDiffCommand(program);
registerSyncCommand(program);
registerSwitchCommand(program);
registerSubmitCommand(program);
registerLandCommand(program);
registerFeaturesCommand(program);   // features, diffs
registerContextCommand(program);
registerStatusCommand(program);
registerLogCommand(program);
registerUndoCommand(program);
registerSplitCommand(program);
registerConfigCommand(program);

// ── Runner commands ───────────────────────────────────────
registerRunnerCommand(program);     // runner start, runner stop, runner status
registerRunCommand(program);
registerRunsCommand(program);
registerWorkflowsCommand(program);
registerSecretCommand(program);
registerDashboardCommand(program);

program.parse();
