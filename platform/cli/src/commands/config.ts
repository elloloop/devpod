import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig, saveConfig, type DevpodConfig } from '../workspace';
import { errorMessage } from '../format';

function getNestedValue(obj: Record<string, unknown>, keyPath: string): unknown {
  const parts = keyPath.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function setNestedValue(obj: Record<string, unknown>, keyPath: string, value: unknown): void {
  const parts = keyPath.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]!] = value;
}

function parseValue(raw: string): unknown {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'off' || raw === 'no') return false;
  if (raw === 'on' || raw === 'yes') return true;
  if (raw === 'null') return null;
  const num = Number(raw);
  if (!isNaN(num) && raw.trim() !== '') return num;
  return raw;
}

function printConfig(config: DevpodConfig): void {
  console.log(chalk.bold('Configuration'));
  console.log();
  console.log(`  ${chalk.dim('defaultBranch')}  ${config.defaultBranch}`);
  console.log();
  console.log(`  ${chalk.dim('llm.enabled')}    ${config.llm.enabled}`);
  console.log(`  ${chalk.dim('llm.provider')}   ${config.llm.provider}`);
  if (config.llm.url) {
    console.log(`  ${chalk.dim('llm.url')}        ${config.llm.url}`);
  }
  if (config.llm.model) {
    console.log(`  ${chalk.dim('llm.model')}      ${config.llm.model}`);
  }
  if (config.llm.apiKey) {
    console.log(`  ${chalk.dim('llm.apiKey')}     ${'*'.repeat(8)}`);
  }
  console.log();
  console.log(`  ${chalk.dim('ci.autoRun')}     ${config.ci.autoRun}`);
  console.log(`  ${chalk.dim('aliases')}        ${config.aliases}`);
}

export function registerConfigCommand(program: Command): void {
  const config = program
    .command('config')
    .description('View or update configuration');

  // Default: show all config
  config.action(async () => {
    try {
      const cfg = loadConfig();
      printConfig(cfg);
    } catch (err) {
      console.error(errorMessage(err));
      process.exit(1);
    }
  });

  // config set <key> <value>
  config
    .command('set')
    .description('Set a configuration value')
    .argument('<key>', 'Config key (e.g., llm.provider, ci.auto)')
    .argument('<value>', 'Value to set')
    .action(async (key: string, value: string) => {
      try {
        const cfg = loadConfig();

        // Handle special shortcuts
        if (key === 'llm' && (value === 'off' || value === 'false')) {
          cfg.llm.enabled = false;
          saveConfig(cfg);
          console.log(`${chalk.green('\u2713')} LLM disabled`);
          return;
        }
        if (key === 'llm' && (value === 'on' || value === 'true')) {
          cfg.llm.enabled = true;
          saveConfig(cfg);
          console.log(`${chalk.green('\u2713')} LLM enabled`);
          return;
        }
        if (key === 'ci.auto') {
          key = 'ci.autoRun';
        }

        const parsed = parseValue(value);
        setNestedValue(cfg as unknown as Record<string, unknown>, key, parsed);
        saveConfig(cfg);
        console.log(`${chalk.green('\u2713')} Set ${chalk.bold(key)} = ${String(parsed)}`);
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });

  // config get <key>
  config
    .command('get')
    .description('Get a configuration value')
    .argument('<key>', 'Config key (e.g., llm.provider)')
    .action(async (key: string) => {
      try {
        const cfg = loadConfig();
        const val = getNestedValue(cfg as unknown as Record<string, unknown>, key);
        if (val === undefined) {
          console.log(chalk.dim(`${key} is not set`));
        } else {
          console.log(String(val));
        }
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });
}
