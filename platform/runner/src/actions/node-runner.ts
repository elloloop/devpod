import { spawn, ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ActionDefinition } from '../types.js';
import {
  createCommandParserState,
  parseCommandLine,
  CommandParserState,
} from './commands.js';

export interface NodeRunnerOpts {
  /** Absolute path to the action directory (containing action.yml). */
  actionPath: string;
  /** The loaded action definition. */
  action: ActionDefinition;
  /** Resolved input values as INPUT_* keys (uppercased). */
  inputEnv: Record<string, string>;
  /** Full set of GITHUB_* and other environment variables. */
  env: Record<string, string>;
  /** Working directory for the action. */
  cwd: string;
  /** Callback for streaming log output. */
  onOutput?: (line: string) => void;
  /** Timeout in milliseconds. */
  timeoutMs?: number;
  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
}

export interface NodeRunnerResult {
  exitCode: number;
  log: string;
  outputs: Record<string, string>;
  envUpdates: Record<string, string>;
  pathAdditions: string[];
  state: Record<string, string>;
}

/**
 * Execute a Node.js-based GitHub Action.
 *
 * GitHub Actions Node.js actions use @actions/core which communicates via:
 * - process.env.INPUT_* for inputs
 * - process.env.GITHUB_OUTPUT file for outputs
 * - process.env.GITHUB_ENV file for env updates
 * - process.env.GITHUB_STATE file for state
 * - process.stdout with ::commands for legacy protocol
 *
 * Since the runner already sets all these env vars, most actions work as-is.
 */
export async function runNodeAction(opts: NodeRunnerOpts): Promise<NodeRunnerResult> {
  const { action, actionPath, inputEnv, env, cwd } = opts;
  const timeoutMs = opts.timeoutMs || 60 * 60 * 1000; // default 1 hour

  if (!action.runs.main) {
    throw new Error(
      `Node action '${action.name}' is missing runs.main entry point`
    );
  }

  const entryPoint = path.resolve(actionPath, action.runs.main);
  if (!fs.existsSync(entryPoint)) {
    throw new Error(
      `Node action entry point not found: ${entryPoint}`
    );
  }

  // Create temp files for GITHUB_OUTPUT, GITHUB_ENV, GITHUB_STATE, GITHUB_PATH
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'runner-node-action-'));
  const outputFile = path.join(tempDir, 'output');
  const envFile = path.join(tempDir, 'env');
  const stateFile = path.join(tempDir, 'state');
  const pathFile = path.join(tempDir, 'path');

  fs.writeFileSync(outputFile, '');
  fs.writeFileSync(envFile, '');
  fs.writeFileSync(stateFile, '');
  fs.writeFileSync(pathFile, '');

  // Build the full environment
  const fullEnv: Record<string, string> = {
    ...process.env as Record<string, string>,
    ...env,
    ...inputEnv,
    GITHUB_OUTPUT: outputFile,
    GITHUB_ENV: envFile,
    GITHUB_STATE: stateFile,
    GITHUB_PATH: pathFile,
    GITHUB_ACTION_PATH: actionPath,
    RUNNER_TEMP: env.RUNNER_TEMP || os.tmpdir(),
    RUNNER_TOOL_CACHE: env.RUNNER_TOOL_CACHE || path.join(os.tmpdir(), 'runner-tool-cache'),
  };

  // Run the pre script first if defined
  let preLog = '';
  if (action.runs.pre) {
    const preEntry = path.resolve(actionPath, action.runs.pre);
    if (fs.existsSync(preEntry)) {
      const preResult = await spawnNode(preEntry, {
        env: fullEnv,
        cwd,
        timeoutMs: 300_000, // 5 min for pre step
        signal: opts.signal,
        onOutput: (line) => {
          preLog += line;
          opts.onOutput?.(line);
        },
      });
      preLog += preResult.output;
    }
  }

  // Run the main script
  const commandState = createCommandParserState();
  let mainLog = '';

  const result = await spawnNode(entryPoint, {
    env: fullEnv,
    cwd,
    timeoutMs,
    signal: opts.signal,
    onOutput: (line) => {
      // Parse workflow commands from stdout
      const cmd = parseCommandLine(line, commandState);
      if (cmd) {
        // Format command output for logging
        switch (cmd.command) {
          case 'group':
            mainLog += `>> ${cmd.message}\n`;
            opts.onOutput?.(`>> ${cmd.message}\n`);
            break;
          case 'endgroup':
            mainLog += `<<\n`;
            opts.onOutput?.(`<<\n`);
            break;
          case 'error':
            mainLog += `Error: ${cmd.message}\n`;
            opts.onOutput?.(`Error: ${cmd.message}\n`);
            break;
          case 'warning':
            mainLog += `Warning: ${cmd.message}\n`;
            opts.onOutput?.(`Warning: ${cmd.message}\n`);
            break;
          case 'notice':
            mainLog += `Notice: ${cmd.message}\n`;
            opts.onOutput?.(`Notice: ${cmd.message}\n`);
            break;
          case 'debug':
            mainLog += `Debug: ${cmd.message}\n`;
            opts.onOutput?.(`Debug: ${cmd.message}\n`);
            break;
          default:
            // set-output, save-state, add-mask: silent
            break;
        }
      } else {
        // Apply masks to regular output
        let filtered = line;
        for (const mask of commandState.masks) {
          if (mask && filtered.includes(mask)) {
            filtered = filtered.split(mask).join('***');
          }
        }
        mainLog += filtered;
        opts.onOutput?.(filtered);
      }
    },
  });

  mainLog += result.output;

  // Parse file-based outputs (GITHUB_OUTPUT)
  const fileOutputs = parseKeyValueFile(outputFile);
  // Merge with legacy command-based outputs (::set-output)
  const outputs = { ...fileOutputs, ...commandState.outputs };

  // Parse GITHUB_ENV
  const envUpdates = parseKeyValueFile(envFile);

  // Parse GITHUB_PATH
  const pathContent = fs.readFileSync(pathFile, 'utf-8').trim();
  const pathAdditions = pathContent ? pathContent.split('\n').filter(Boolean) : [];

  // Parse GITHUB_STATE
  const stateFromFile = parseKeyValueFile(stateFile);
  const state = { ...stateFromFile, ...commandState.state };

  // Cleanup temp files
  try { fs.rmSync(tempDir, { recursive: true }); } catch { /* ignore */ }

  const log = preLog + mainLog;

  return {
    exitCode: result.exitCode,
    log,
    outputs,
    envUpdates,
    pathAdditions,
    state,
  };
}

/**
 * Run a post-action script (runs.post from action.yml).
 * This is called after the main step completes, typically during job cleanup.
 */
export async function runNodeActionPost(opts: {
  actionPath: string;
  action: ActionDefinition;
  env: Record<string, string>;
  inputEnv: Record<string, string>;
  state: Record<string, string>;
  cwd: string;
  onOutput?: (line: string) => void;
  signal?: AbortSignal;
}): Promise<void> {
  if (!opts.action.runs.post) return;

  const postEntry = path.resolve(opts.actionPath, opts.action.runs.post);
  if (!fs.existsSync(postEntry)) return;

  // Build state env vars (STATE_*)
  const stateEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(opts.state)) {
    stateEnv[`STATE_${key}`] = value;
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'runner-node-post-'));
  const outputFile = path.join(tempDir, 'output');
  const envFile = path.join(tempDir, 'env');
  const stateFile = path.join(tempDir, 'state');
  const pathFile = path.join(tempDir, 'path');

  fs.writeFileSync(outputFile, '');
  fs.writeFileSync(envFile, '');
  fs.writeFileSync(stateFile, '');
  fs.writeFileSync(pathFile, '');

  const fullEnv: Record<string, string> = {
    ...process.env as Record<string, string>,
    ...opts.env,
    ...opts.inputEnv,
    ...stateEnv,
    GITHUB_OUTPUT: outputFile,
    GITHUB_ENV: envFile,
    GITHUB_STATE: stateFile,
    GITHUB_PATH: pathFile,
    GITHUB_ACTION_PATH: opts.actionPath,
  };

  await spawnNode(postEntry, {
    env: fullEnv,
    cwd: opts.cwd,
    timeoutMs: 300_000, // 5 min for post step
    signal: opts.signal,
    onOutput: opts.onOutput,
  });

  try { fs.rmSync(tempDir, { recursive: true }); } catch { /* ignore */ }
}

// ── Internals ──

interface SpawnNodeOpts {
  env: Record<string, string>;
  cwd: string;
  timeoutMs: number;
  signal?: AbortSignal;
  onOutput?: (line: string) => void;
}

function spawnNode(
  scriptPath: string,
  opts: SpawnNodeOpts,
): Promise<{ exitCode: number; output: string }> {
  return new Promise((resolve, reject) => {
    let output = '';
    let child: ChildProcess;

    try {
      child = spawn('node', [scriptPath], {
        cwd: opts.cwd,
        env: opts.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      return reject(new Error(`Failed to spawn node for ${scriptPath}: ${err}`));
    }

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 5000);
      reject(new Error(`Node action timed out after ${opts.timeoutMs}ms`));
    }, opts.timeoutMs);

    if (opts.signal) {
      opts.signal.addEventListener('abort', () => {
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 5000);
        clearTimeout(timeout);
        reject(new Error('Cancelled'));
      }, { once: true });
    }

    // Buffer partial lines for line-by-line emission
    let stdoutBuf = '';
    let stderrBuf = '';

    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      output += text;
      stdoutBuf += text;

      const lines = stdoutBuf.split('\n');
      // Keep the last (possibly incomplete) line in the buffer
      stdoutBuf = lines.pop() || '';
      for (const line of lines) {
        opts.onOutput?.(line + '\n');
      }
    });

    child.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      output += text;
      stderrBuf += text;

      const lines = stderrBuf.split('\n');
      stderrBuf = lines.pop() || '';
      for (const line of lines) {
        opts.onOutput?.(line + '\n');
      }
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      // Flush any remaining buffered output
      if (stdoutBuf) opts.onOutput?.(stdoutBuf + '\n');
      if (stderrBuf) opts.onOutput?.(stderrBuf + '\n');
      resolve({ exitCode: code ?? 1, output: '' });
    });
  });
}

/**
 * Parse a GITHUB_OUTPUT / GITHUB_ENV / GITHUB_STATE style key-value file.
 * Supports single-line `key=value` and heredoc-style:
 *   key<<delimiter
 *   value lines
 *   delimiter
 */
function parseKeyValueFile(filePath: string): Record<string, string> {
  const result: Record<string, string> = {};

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (!content.trim()) return result;

    const lines = content.split('\n');
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Heredoc style: key<<DELIMITER
      const heredocMatch = line.match(/^(.+?)<<(.+)$/);
      if (heredocMatch) {
        const key = heredocMatch[1];
        const delimiter = heredocMatch[2];
        const valueLines: string[] = [];
        i++;
        while (i < lines.length && lines[i] !== delimiter) {
          valueLines.push(lines[i]);
          i++;
        }
        result[key] = valueLines.join('\n');
        i++;
        continue;
      }

      // Simple key=value
      const eqIdx = line.indexOf('=');
      if (eqIdx > 0) {
        const key = line.slice(0, eqIdx);
        const value = line.slice(eqIdx + 1);
        result[key] = value;
      }

      i++;
    }
  } catch {
    // File might not exist or be empty
  }

  return result;
}
