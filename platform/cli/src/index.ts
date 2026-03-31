import { Command } from 'commander';
import { registerRunCommand } from './commands/run';
import { registerRunsCommand } from './commands/runs';
import { registerWorkflowsCommand } from './commands/workflows';
import { registerSecretCommand } from './commands/secret';
import { registerStatusCommand } from './commands/status';
import { registerStartCommand } from './commands/start';
import { registerDashboardCommand } from './commands/dashboard';

const program = new Command();

program
  .name('devpod')
  .description('CLI for the devpod local runner')
  .version('1.0.0');

registerRunCommand(program);
registerRunsCommand(program);
registerWorkflowsCommand(program);
registerSecretCommand(program);
registerStatusCommand(program);
registerStartCommand(program);
registerDashboardCommand(program);

program.parse();
