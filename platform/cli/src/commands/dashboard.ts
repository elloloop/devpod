import { Command } from 'commander';
import chalk from 'chalk';
import { spawn } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { errorMessage } from '../format';

export function registerDashboardCommand(program: Command): void {
  program
    .command('dashboard')
    .description('Start the web dashboard')
    .option('-p, --port <port>', 'Port number', '3000')
    .action(async (opts: { port: string }) => {
      try {
        // Find the web dashboard relative to CLI location
        const cliDir = path.resolve(__dirname, '..', '..');
        const platformDir = path.resolve(cliDir, '..');
        const webDir = path.join(platformDir, 'web');

        if (!fs.existsSync(webDir)) {
          console.error(
            chalk.red(
              `Dashboard not found at ${webDir}`,
            ),
          );
          console.log(chalk.dim('Expected the web dashboard at platform/web/'));
          process.exit(1);
        }

        console.log(
          `Starting dashboard on port ${chalk.cyan(opts.port)}...`,
        );

        const child = spawn('npm', ['run', 'dev', '--', '--port', opts.port], {
          cwd: webDir,
          stdio: 'inherit',
          env: {
            ...process.env,
            PORT: opts.port,
          },
        });

        child.on('error', (err) => {
          console.error(chalk.red(`Failed to start dashboard: ${err.message}`));
          process.exit(1);
        });

        child.on('exit', (code) => {
          if (code !== 0 && code !== null) {
            process.exit(code);
          }
        });

        // Handle SIGINT/SIGTERM to cleanly shut down child
        const cleanup = () => {
          child.kill('SIGTERM');
        };
        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });
}
