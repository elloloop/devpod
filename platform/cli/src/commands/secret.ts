import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as readline from 'node:readline';
import * as fs from 'node:fs';
import * as api from '../api';
import { statusIcon, table, errorMessage } from '../format';

interface Secret {
  name: string;
  source?: string;
}

interface Backend {
  name: string;
  status: string;
  detail?: string;
}

export function registerSecretCommand(program: Command): void {
  const secret = program
    .command('secret')
    .description('Manage secrets');

  // Set a secret
  secret
    .command('set')
    .description('Set a secret value')
    .argument('<name>', 'Secret name')
    .argument('[value]', 'Secret value (reads from stdin if omitted)')
    .action(async (name: string, value?: string) => {
      try {
        if (value) {
          // Value provided on command line
          await api.put(`/api/secrets/${encodeURIComponent(name)}`, { value });
          console.log(`${chalk.green('\u2713')} Secret ${chalk.bold(name)} set`);
          return;
        }

        // Check if stdin has data (piped)
        if (!process.stdin.isTTY) {
          const chunks: Buffer[] = [];
          for await (const chunk of process.stdin) {
            chunks.push(chunk as Buffer);
          }
          const stdinValue = Buffer.concat(chunks).toString().trim();
          if (stdinValue) {
            await api.put(`/api/secrets/${encodeURIComponent(name)}`, {
              value: stdinValue,
            });
            console.log(`${chalk.green('\u2713')} Secret ${chalk.bold(name)} set`);
            return;
          }
        }

        // Interactive prompt with hidden input
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const secretValue = await new Promise<string>((resolve) => {
          process.stdout.write(`Enter value for ${chalk.bold(name)}: `);
          const stdin = process.stdin;

          // Try to hide input
          if (stdin.isTTY) {
            stdin.setRawMode(true);
          }

          let input = '';
          const onData = (data: Buffer) => {
            const char = data.toString();
            if (char === '\n' || char === '\r') {
              stdin.removeListener('data', onData);
              if (stdin.isTTY) {
                stdin.setRawMode(false);
              }
              process.stdout.write('\n');
              rl.close();
              resolve(input);
            } else if (char === '\u007f' || char === '\b') {
              // Backspace
              if (input.length > 0) {
                input = input.slice(0, -1);
              }
            } else if (char === '\u0003') {
              // Ctrl+C
              process.stdout.write('\n');
              process.exit(0);
            } else {
              input += char;
            }
          };

          stdin.on('data', onData);
        });

        if (!secretValue) {
          console.error(chalk.red('No value provided'));
          process.exit(1);
        }

        await api.put(`/api/secrets/${encodeURIComponent(name)}`, {
          value: secretValue,
        });
        console.log(`${chalk.green('\u2713')} Secret ${chalk.bold(name)} set`);
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });

  // List secrets
  secret
    .command('list')
    .description('List secret names')
    .action(async () => {
      try {
        const data = await api.get<Secret[]>('/api/secrets');

        if (!data || data.length === 0) {
          console.log(chalk.dim('No secrets configured.'));
          return;
        }

        for (const s of data) {
          if (s.source) {
            console.log(`${s.name}  ${chalk.dim(`(${s.source})`)}`);
          } else {
            console.log(s.name);
          }
        }
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });

  // Delete a secret
  secret
    .command('delete')
    .description('Delete a secret')
    .argument('<name>', 'Secret name')
    .action(async (name: string) => {
      try {
        await api.del(`/api/secrets/${encodeURIComponent(name)}`);
        console.log(`${chalk.green('\u2713')} Secret ${chalk.bold(name)} deleted`);
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });

  // Import from .env file
  secret
    .command('import')
    .description('Import secrets from a .env file')
    .argument('<file>', 'Path to .env file')
    .action(async (file: string) => {
      try {
        if (!fs.existsSync(file)) {
          console.error(chalk.red(`File not found: ${file}`));
          process.exit(1);
        }

        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        let count = 0;

        const spinner = ora('Importing secrets...').start();

        for (const line of lines) {
          const trimmed = line.trim();
          // Skip empty lines and comments
          if (!trimmed || trimmed.startsWith('#')) continue;

          const eqIdx = trimmed.indexOf('=');
          if (eqIdx === -1) continue;

          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();

          // Strip surrounding quotes
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }

          if (key) {
            await api.put(`/api/secrets/${encodeURIComponent(key)}`, {
              value: val,
            });
            count++;
          }
        }

        spinner.succeed(`Imported ${count} secret${count !== 1 ? 's' : ''} from ${file}`);
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });

  // Sync secrets from cloud backends
  secret
    .command('sync')
    .description('Sync secrets from cloud backends')
    .action(async () => {
      try {
        const spinner = ora('Syncing secrets from backends...').start();
        const result = await api.post<{ synced: number }>('/api/secrets/sync');
        spinner.succeed(
          `Synced ${result?.synced ?? 0} secret${(result?.synced ?? 0) !== 1 ? 's' : ''} from backends`,
        );
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });

  // Backend status
  secret
    .command('status')
    .description('Show backend status')
    .action(async () => {
      try {
        const data = await api.get<Backend[]>('/api/secrets/backends');

        if (!data || data.length === 0) {
          console.log(chalk.dim('No backends configured.'));
          return;
        }

        const rows = data.map((b) => {
          const icon = statusIcon(b.status);
          const detail = b.detail ? chalk.dim(` (${b.detail})`) : '';
          return [b.name, `${icon} ${b.status}${detail}`];
        });

        console.log(table(rows, ['Backend', 'Status']));
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });
}
