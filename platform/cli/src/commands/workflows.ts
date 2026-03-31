import { Command } from 'commander';
import chalk from 'chalk';
import * as api from '../api';
import { table, errorMessage } from '../format';

interface Workflow {
  name: string;
  file: string;
  triggers?: string[];
  jobs?: string[];
  description?: string;
}

export function registerWorkflowsCommand(program: Command): void {
  program
    .command('workflows')
    .description('List available workflows')
    .action(async () => {
      try {
        const data = await api.get<Workflow[]>('/api/workflows');

        if (!data || data.length === 0) {
          console.log(chalk.dim('No workflows found.'));
          return;
        }

        const rows = data.map((wf) => [
          chalk.bold(wf.name),
          chalk.dim(wf.file),
          wf.triggers ? wf.triggers.join(', ') : '\u2014',
          wf.jobs ? wf.jobs.join(', ') : '\u2014',
        ]);

        console.log(table(rows, ['Name', 'File', 'Triggers', 'Jobs']));
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });
}
