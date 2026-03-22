import { spawn, ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ActionDefinition } from '../types.js';
import {
  createCommandParserState,
  parseCommandLine,
} from './commands.js';

export interface DockerRunnerOpts {
  /** Absolute path to the action directory (containing action.yml), or null for docker:// refs. */
  actionPath: string | null;
  /** The loaded action definition, or null for docker:// refs. */
  action: ActionDefinition | null;
  /** Docker image for direct docker:// references (e.g., "node:18"). Null for action.yml-based. */
  dockerImage: string | null;
  /** Resolved input values as INPUT_* keys (uppercased). */
  inputEnv: Record<string, string>;
  /** Full set of GITHUB_* and other environment variables. */
  env: Record<string, string>;
  /** Workspace path to mount. */
  workspacePath: string;
  /** Args to pass to the container (from action.yml or step definition). */
  args?: string[];
  /** Entrypoint override (from action.yml runs.entrypoint). */
  entrypoint?: string;
  /** Callback for streaming log output. */
  onOutput?: (line: string) => void;
  /** Timeout in milliseconds. */
  timeoutMs?: number;
  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
}

export interface DockerRunnerResult {
  exitCode: number;
  log: string;
  outputs: Record<string, string>;
  envUpdates: Record<string, string>;
  pathAdditions: string[];
}

/**
 * Execute a Docker-based GitHub Action.
 *
 * Supports:
 * - Dockerfile-based: action.yml has `runs.image: 'Dockerfile'`
 * - Pre-built image: action.yml has `runs.image: 'docker://image:tag'`
 * - Direct docker:// reference: `uses: docker://node:18` (no action.yml)
 */
export async function runDockerAction(opts: DockerRunnerOpts): Promise<DockerRunnerResult> {
  const timeoutMs = opts.timeoutMs || 60 * 60 * 1000;

  // Determine which image to use
  let image: string;

  if (opts.dockerImage) {
    // Direct docker:// reference
    image = opts.dockerImage;
    opts.onOutput?.(`Pulling docker image ${image}...\n`);
    await dockerPull(image, opts.onOutput);
  } else if (opts.action && opts.actionPath) {
    const runsImage = opts.action.runs.image;
    if (!runsImage) {
      throw new Error(`Docker action '${opts.action.name}' missing runs.image`);
    }

    if (runsImage === 'Dockerfile') {
      // Build from Dockerfile in the action directory
      image = `local-runner-action-${sanitizeImageTag(opts.actionPath)}`;
      opts.onOutput?.(`Building Docker image from ${opts.actionPath}/Dockerfile...\n`);
      await dockerBuild(opts.actionPath, image, opts.onOutput);
    } else if (runsImage.startsWith('docker://')) {
      // Pre-built image reference
      image = runsImage.slice('docker://'.length);
      opts.onOutput?.(`Pulling docker image ${image}...\n`);
      await dockerPull(image, opts.onOutput);
    } else {
      // Treat as a Dockerfile path relative to the action
      const dockerfilePath = path.resolve(opts.actionPath, runsImage);
      image = `local-runner-action-${sanitizeImageTag(opts.actionPath)}`;
      opts.onOutput?.(`Building Docker image from ${dockerfilePath}...\n`);
      await dockerBuild(path.dirname(dockerfilePath), image, opts.onOutput, path.basename(dockerfilePath));
    }
  } else {
    throw new Error('Docker action requires either a docker image or an action definition');
  }

  // Create temp files for GITHUB_OUTPUT, GITHUB_ENV, GITHUB_PATH
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'runner-docker-action-'));
  const outputFile = path.join(tempDir, 'output');
  const envFile = path.join(tempDir, 'env');
  const pathFile = path.join(tempDir, 'path');

  fs.writeFileSync(outputFile, '');
  fs.writeFileSync(envFile, '');
  fs.writeFileSync(pathFile, '');

  // Build docker run arguments
  const dockerArgs: string[] = ['run', '--rm'];

  // Workspace mount
  dockerArgs.push('-v', `${opts.workspacePath}:/github/workspace`);
  dockerArgs.push('--workdir', '/github/workspace');

  // Mount the output/env/path files
  dockerArgs.push('-v', `${outputFile}:/github/file-commands/output`);
  dockerArgs.push('-v', `${envFile}:/github/file-commands/env`);
  dockerArgs.push('-v', `${pathFile}:/github/file-commands/path`);

  // Mount a temp/home directory
  const homeDir = path.join(tempDir, 'home');
  fs.mkdirSync(homeDir, { recursive: true });
  dockerArgs.push('-v', `${homeDir}:/github/home`);

  // Pass environment variables
  const containerEnv: Record<string, string> = {
    ...opts.env,
    ...opts.inputEnv,
    HOME: '/github/home',
    GITHUB_WORKSPACE: '/github/workspace',
    GITHUB_OUTPUT: '/github/file-commands/output',
    GITHUB_ENV: '/github/file-commands/env',
    GITHUB_PATH: '/github/file-commands/path',
  };

  // Remove variables that contain host-specific paths we've remapped
  // (they've been replaced above with container paths)

  for (const [key, value] of Object.entries(containerEnv)) {
    dockerArgs.push('--env', `${key}=${value}`);
  }

  // Entrypoint override
  const entrypoint = opts.entrypoint || opts.action?.runs.entrypoint;
  if (entrypoint) {
    dockerArgs.push('--entrypoint', entrypoint);
  }

  // Image
  dockerArgs.push(image);

  // Args (from action.yml or passed in)
  const actionArgs = opts.args || opts.action?.runs.args;
  if (actionArgs && actionArgs.length > 0) {
    dockerArgs.push(...actionArgs);
  }

  // Run the container
  const commandState = createCommandParserState();
  let log = '';

  const result = await spawnDocker(dockerArgs, {
    timeoutMs,
    signal: opts.signal,
    onOutput: (line) => {
      const cmd = parseCommandLine(line, commandState);
      if (cmd) {
        switch (cmd.command) {
          case 'group':
            log += `>> ${cmd.message}\n`;
            opts.onOutput?.(`>> ${cmd.message}\n`);
            break;
          case 'endgroup':
            log += `<<\n`;
            opts.onOutput?.(`<<\n`);
            break;
          case 'error':
            log += `Error: ${cmd.message}\n`;
            opts.onOutput?.(`Error: ${cmd.message}\n`);
            break;
          case 'warning':
            log += `Warning: ${cmd.message}\n`;
            opts.onOutput?.(`Warning: ${cmd.message}\n`);
            break;
          case 'notice':
            log += `Notice: ${cmd.message}\n`;
            opts.onOutput?.(`Notice: ${cmd.message}\n`);
            break;
          case 'debug':
            log += `Debug: ${cmd.message}\n`;
            opts.onOutput?.(`Debug: ${cmd.message}\n`);
            break;
          default:
            break;
        }
      } else {
        let filtered = line;
        for (const mask of commandState.masks) {
          if (mask && filtered.includes(mask)) {
            filtered = filtered.split(mask).join('***');
          }
        }
        log += filtered;
        opts.onOutput?.(filtered);
      }
    },
  });

  log += result.output;

  // Parse file-based outputs
  const fileOutputs = parseKeyValueFile(outputFile);
  const outputs = { ...fileOutputs, ...commandState.outputs };

  const envUpdates = parseKeyValueFile(envFile);

  const pathContent = fs.readFileSync(pathFile, 'utf-8').trim();
  const pathAdditions = pathContent ? pathContent.split('\n').filter(Boolean) : [];

  // Cleanup
  try { fs.rmSync(tempDir, { recursive: true }); } catch { /* ignore */ }

  return {
    exitCode: result.exitCode,
    log,
    outputs,
    envUpdates,
    pathAdditions,
  };
}

// ── Docker helpers ──

async function dockerPull(image: string, onOutput?: (line: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['pull', image], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout?.on('data', (data: Buffer) => {
      onOutput?.(data.toString());
    });

    child.stderr?.on('data', (data: Buffer) => {
      onOutput?.(data.toString());
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to pull docker image '${image}': ${err.message}`));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`docker pull '${image}' failed with exit code ${code}`));
      } else {
        resolve();
      }
    });
  });
}

async function dockerBuild(
  contextPath: string,
  tag: string,
  onOutput?: (line: string) => void,
  dockerfile?: string,
): Promise<void> {
  const args = ['build', '-t', tag];
  if (dockerfile) {
    args.push('-f', path.join(contextPath, dockerfile));
  }
  args.push(contextPath);

  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout?.on('data', (data: Buffer) => {
      onOutput?.(data.toString());
    });

    child.stderr?.on('data', (data: Buffer) => {
      onOutput?.(data.toString());
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to build docker image: ${err.message}`));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`docker build failed with exit code ${code}`));
      } else {
        resolve();
      }
    });
  });
}

function spawnDocker(
  args: string[],
  opts: { timeoutMs: number; signal?: AbortSignal; onOutput?: (line: string) => void },
): Promise<{ exitCode: number; output: string }> {
  return new Promise((resolve, reject) => {
    let output = '';
    let child: ChildProcess;

    try {
      child = spawn('docker', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      return reject(new Error(`Failed to spawn docker: ${err}`));
    }

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 5000);
      reject(new Error(`Docker action timed out after ${opts.timeoutMs}ms`));
    }, opts.timeoutMs);

    if (opts.signal) {
      opts.signal.addEventListener('abort', () => {
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 5000);
        clearTimeout(timeout);
        reject(new Error('Cancelled'));
      }, { once: true });
    }

    let stdoutBuf = '';
    let stderrBuf = '';

    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      output += text;
      stdoutBuf += text;

      const lines = stdoutBuf.split('\n');
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
      if (stdoutBuf) opts.onOutput?.(stdoutBuf + '\n');
      if (stderrBuf) opts.onOutput?.(stderrBuf + '\n');
      resolve({ exitCode: code ?? 1, output: '' });
    });
  });
}

function sanitizeImageTag(input: string): string {
  return input
    .replace(/[^a-z0-9._-]/gi, '-')
    .replace(/-+/g, '-')
    .slice(0, 64)
    .toLowerCase();
}

/**
 * Parse a GITHUB_OUTPUT / GITHUB_ENV style key-value file.
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
