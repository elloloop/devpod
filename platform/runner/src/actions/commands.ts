/**
 * Parse GitHub Actions workflow commands from stdout lines.
 *
 * Format: ::command param1=value1,param2=value2::message
 *
 * Commands:
 * - ::set-output name=key::value (deprecated but still used)
 * - ::error file=f,line=l,col=c::message
 * - ::warning file=f,line=l,col=c::message
 * - ::notice file=f,line=l,col=c::message
 * - ::debug::message
 * - ::group::title
 * - ::endgroup::
 * - ::add-mask::value
 * - ::stop-commands::token
 * - ::token:: (resume commands after stop-commands)
 * - ::save-state name=key::value
 */

export interface WorkflowCommand {
  command: string;
  params: Record<string, string>;
  message: string;
}

export interface CommandParserState {
  outputs: Record<string, string>;
  state: Record<string, string>;
  masks: string[];
  stopToken: string | null;
  annotations: Annotation[];
  debugMessages: string[];
}

export interface Annotation {
  level: 'error' | 'warning' | 'notice';
  message: string;
  file?: string;
  line?: number;
  col?: number;
  endLine?: number;
  endColumn?: number;
}

/**
 * Create a fresh command parser state.
 */
export function createCommandParserState(): CommandParserState {
  return {
    outputs: {},
    state: {},
    masks: [],
    stopToken: null,
    annotations: [],
    debugMessages: [],
  };
}

/**
 * Parse a single line of output for workflow commands.
 * Returns the parsed command (if any) and mutates the parser state.
 *
 * Returns null if the line is not a command or commands are stopped,
 * in which case the line should be treated as regular output.
 */
export function parseCommandLine(
  line: string,
  state: CommandParserState,
): WorkflowCommand | null {
  const trimmed = line.trimEnd();

  // Check for command format: ::command params::message
  const match = trimmed.match(/^::([a-zA-Z][\w-]*)\s*(.*?)::(.*)$/);
  if (!match) return null;

  const command = match[1].toLowerCase();
  const paramsStr = match[2];
  const message = unescapeCommandValue(match[3]);

  // Handle stop-commands / resume
  if (state.stopToken !== null) {
    // If the command matches the stop token, resume
    if (command === state.stopToken) {
      state.stopToken = null;
      return { command, params: {}, message };
    }
    // Otherwise, treat line as regular output
    return null;
  }

  const params = parseCommandParams(paramsStr);
  const cmd: WorkflowCommand = { command, params, message };

  // Process the command
  switch (command) {
    case 'set-output': {
      const name = params.name;
      if (name) {
        state.outputs[name] = message;
      }
      break;
    }

    case 'save-state': {
      const name = params.name;
      if (name) {
        state.state[name] = message;
      }
      break;
    }

    case 'error':
    case 'warning':
    case 'notice': {
      const annotation: Annotation = {
        level: command as 'error' | 'warning' | 'notice',
        message,
      };
      if (params.file) annotation.file = params.file;
      if (params.line) annotation.line = parseInt(params.line, 10);
      if (params.col) annotation.col = parseInt(params.col, 10);
      if (params.endLine) annotation.endLine = parseInt(params.endLine, 10);
      if (params.endColumn) annotation.endColumn = parseInt(params.endColumn, 10);
      state.annotations.push(annotation);
      break;
    }

    case 'debug':
      state.debugMessages.push(message);
      break;

    case 'add-mask':
      if (message) {
        state.masks.push(message);
      }
      break;

    case 'stop-commands':
      if (message) {
        state.stopToken = message;
      }
      break;

    case 'group':
    case 'endgroup':
      // These are informational for log grouping; we just pass them through
      break;

    default:
      // Unknown command; still return it so callers can handle
      break;
  }

  return cmd;
}

/**
 * Process all lines from a command output, extracting workflow commands
 * and returning the filtered output (with command lines removed).
 */
export function processCommandOutput(
  output: string,
  state: CommandParserState,
): string {
  const lines = output.split('\n');
  const filteredLines: string[] = [];

  for (const line of lines) {
    const cmd = parseCommandLine(line, state);
    if (cmd) {
      // Command was processed; don't include in filtered output
      // unless it's a group/endgroup/error/warning/notice (still show in log)
      switch (cmd.command) {
        case 'group':
          filteredLines.push(`>> ${cmd.message}`);
          break;
        case 'endgroup':
          filteredLines.push(`<<`);
          break;
        case 'error':
          filteredLines.push(`Error: ${cmd.message}`);
          break;
        case 'warning':
          filteredLines.push(`Warning: ${cmd.message}`);
          break;
        case 'notice':
          filteredLines.push(`Notice: ${cmd.message}`);
          break;
        case 'debug':
          filteredLines.push(`Debug: ${cmd.message}`);
          break;
        default:
          // set-output, save-state, add-mask, stop-commands: strip from output
          break;
      }
    } else {
      // Regular output line (or commands are stopped)
      let filtered = line;
      // Apply masks
      for (const mask of state.masks) {
        if (mask && filtered.includes(mask)) {
          filtered = filtered.split(mask).join('***');
        }
      }
      filteredLines.push(filtered);
    }
  }

  return filteredLines.join('\n');
}

/**
 * Parse command parameters from the params section.
 * Format: name=value,param2=value2
 */
function parseCommandParams(paramsStr: string): Record<string, string> {
  const params: Record<string, string> = {};
  if (!paramsStr.trim()) return params;

  // Split on commas, but be careful with values that might contain commas
  // The GitHub format uses simple key=value,key=value
  const parts = paramsStr.split(',');
  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx > 0) {
      const key = part.slice(0, eqIdx).trim();
      const value = unescapeCommandValue(part.slice(eqIdx + 1).trim());
      params[key] = value;
    }
  }

  return params;
}

/**
 * Unescape special characters in workflow command values.
 * GitHub Actions uses percent-encoding for special characters:
 *   %25 → %
 *   %0D → \r
 *   %0A → \n
 *   %3A → :
 *   %2C → ,
 */
function unescapeCommandValue(value: string): string {
  return value
    .replace(/%25/g, '%')
    .replace(/%0D/g, '\r')
    .replace(/%0A/g, '\n')
    .replace(/%3A/g, ':')
    .replace(/%2C/g, ',');
}
