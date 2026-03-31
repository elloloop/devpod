import { Command } from 'commander';
import chalk from 'chalk';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as api from '../api';
import { errorMessage } from '../format';

const PID_DIR = path.join(os.homedir(), '.local', 'share', 'devpod');
const PID_FILE = path.join(PID_DIR, 'runner.pid');

function ensurePidDir(): void {
  if (!fs.existsSync(PID_DIR)) {
    fs.mkdirSync(PID_DIR, { recursive: true });
  }
}

function readPid(): number | null {
  try {
    const content = fs.readFileSync(PID_FILE, 'utf-8').trim();
    const pid = parseInt(content, 10);
    if (isNaN(pid)) return null;

    // Check if process is alive
    try {
      process.kill(pid, 0);
      return pid;
    } catch {
      // Process not running, clean up stale PID file
      fs.unlinkSync(PID_FILE);
      return null;
    }
  } catch {
    return null;
  }
}

export function registerRunnerCommand(program: Command): void {
  const runner = program
    .command('runner')
    .description('Manage the local runner');

  // runner start
  runner
    .command('start')
    .description('Start the runner')
    .option('-w, --workspace <path>', 'Workspace path', process.cwd())
    .option('-p, --port <port>', 'Port number', '4800')
    .action(async (opts: { workspace: string; port: string }) => {
      try {
        // Check if already running
        const existingPid = readPid();
        if (existingPid) {
          const isUp = await api.ping();
          if (isUp) {
            console.log(
              `Runner is already running ${chalk.dim(`(PID ${existingPid})`)}`,
            );
            return;
          }
        }

        console.log(
          `Starting runner on port ${chalk.cyan(opts.port)} for ${chalk.cyan(opts.workspace)}...`,
        );

        // Find the runner entry point relative to CLI location
        const cliDir = path.resolve(__dirname, '..', '..');
        const platformDir = path.resolve(cliDir, '..');
        const runnerDir = path.join(platformDir, 'runner');
        const runnerEntry = path.join(runnerDir, 'src', 'index.ts');

        let runnerCmd: string;
        let runnerArgs: string[];

        if (fs.existsSync(runnerEntry)) {
          runnerCmd = 'npx';
          runnerArgs = ['tsx', runnerEntry];
        } else {
          // Fallback: assume runner is on PATH
          runnerCmd = 'devpod-runner';
          runnerArgs = [];
        }

        const child = spawn(runnerCmd, runnerArgs, {
          detached: true,
          stdio: 'ignore',
          env: {
            ...process.env,
            PORT: opts.port,
            WORKSPACE: opts.workspace,
          },
          cwd: opts.workspace,
        });

        if (child.pid) {
          ensurePidDir();
          fs.writeFileSync(PID_FILE, String(child.pid));
          child.unref();

          console.log(
            `${chalk.green('\u2713')} Runner started ${chalk.dim(`(PID ${child.pid})`)}`,
          );
          console.log(
            chalk.dim(`  http://localhost:${opts.port}`),
          );
        } else {
          console.error(chalk.red('Failed to start runner'));
          process.exit(1);
        }
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });

  // runner stop
  runner
    .command('stop')
    .description('Stop the runner')
    .action(async () => {
      try {
        const pid = readPid();
        if (!pid) {
          console.log(chalk.dim('Runner is not running (no PID file found)'));
          return;
        }

        try {
          process.kill(pid, 'SIGTERM');
          try {
            fs.unlinkSync(PID_FILE);
          } catch {
            // ignore
          }
          console.log(
            `${chalk.green('\u2713')} Runner stopped ${chalk.dim(`(PID ${pid})`)}`,
          );
        } catch {
          console.log(chalk.dim('Runner process not found, cleaning up PID file'));
          try {
            fs.unlinkSync(PID_FILE);
          } catch {
            // ignore
          }
        }
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });

  // runner status
  runner
    .command('status')
    .description('Check runner status')
    .action(async () => {
      try {
        const runnerUrl = api.getRunnerUrl();
        const isUp = await api.ping();
        const pid = readPid();

        if (isUp) {
          const pidStr = pid ? chalk.dim(` (PID ${pid})`) : '';
          console.log(
            `${chalk.green('\u2713')} Runner is running at ${chalk.cyan(runnerUrl)}${pidStr}`,
          );
        } else {
          console.log(
            `${chalk.red('\u2717')} Runner is not running at ${chalk.dim(runnerUrl)}`,
          );
          console.log(
            chalk.dim('  Start with: devpod runner start'),
          );
        }
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });
}
