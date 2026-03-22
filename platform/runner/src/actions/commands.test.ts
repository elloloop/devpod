import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCommandParserState,
  parseCommandLine,
  processCommandOutput,
  CommandParserState,
} from './commands.js';

let state: CommandParserState;

beforeEach(() => {
  state = createCommandParserState();
});

describe('parseCommandLine', () => {
  it('parses ::set-output name=key::value', () => {
    const cmd = parseCommandLine('::set-output name=key::value', state);
    expect(cmd).not.toBeNull();
    expect(cmd!.command).toBe('set-output');
    expect(cmd!.params.name).toBe('key');
    expect(cmd!.message).toBe('value');
    expect(state.outputs.key).toBe('value');
  });

  it('parses ::error::message', () => {
    const cmd = parseCommandLine('::error::Something went wrong', state);
    expect(cmd).not.toBeNull();
    expect(cmd!.command).toBe('error');
    expect(cmd!.message).toBe('Something went wrong');
    expect(state.annotations).toHaveLength(1);
    expect(state.annotations[0].level).toBe('error');
    expect(state.annotations[0].message).toBe('Something went wrong');
  });

  it('parses ::warning file=f,line=1::msg with params', () => {
    const cmd = parseCommandLine('::warning file=test.ts,line=42::Deprecation notice', state);
    expect(cmd).not.toBeNull();
    expect(cmd!.command).toBe('warning');
    expect(state.annotations).toHaveLength(1);
    expect(state.annotations[0].level).toBe('warning');
    expect(state.annotations[0].file).toBe('test.ts');
    expect(state.annotations[0].line).toBe(42);
    expect(state.annotations[0].message).toBe('Deprecation notice');
  });

  it('parses ::debug::msg', () => {
    const cmd = parseCommandLine('::debug::Debug info here', state);
    expect(cmd).not.toBeNull();
    expect(cmd!.command).toBe('debug');
    expect(cmd!.message).toBe('Debug info here');
    expect(state.debugMessages).toContain('Debug info here');
  });

  it('parses ::group::title and ::endgroup::', () => {
    const groupCmd = parseCommandLine('::group::Build Step', state);
    expect(groupCmd).not.toBeNull();
    expect(groupCmd!.command).toBe('group');
    expect(groupCmd!.message).toBe('Build Step');

    const endGroupCmd = parseCommandLine('::endgroup::', state);
    expect(endGroupCmd).not.toBeNull();
    expect(endGroupCmd!.command).toBe('endgroup');
  });

  it('parses ::add-mask::secret', () => {
    const cmd = parseCommandLine('::add-mask::my-secret-value', state);
    expect(cmd).not.toBeNull();
    expect(cmd!.command).toBe('add-mask');
    expect(state.masks).toContain('my-secret-value');
  });

  it('parses ::stop-commands::token and resumes with ::token::', () => {
    // Stop commands
    const stopCmd = parseCommandLine('::stop-commands::pause-token', state);
    expect(stopCmd).not.toBeNull();
    expect(stopCmd!.command).toBe('stop-commands');
    expect(state.stopToken).toBe('pause-token');

    // During stop, commands should not be parsed
    const duringStop = parseCommandLine('::error::This should be ignored', state);
    expect(duringStop).toBeNull(); // treated as regular output
    expect(state.annotations).toHaveLength(0);

    // Resume
    const resumeCmd = parseCommandLine('::pause-token::', state);
    expect(resumeCmd).not.toBeNull();
    expect(state.stopToken).toBeNull();

    // Now commands should work again
    const afterResume = parseCommandLine('::error::Now this works', state);
    expect(afterResume).not.toBeNull();
    expect(state.annotations).toHaveLength(1);
  });

  it('regular line (no ::) is not parsed as command', () => {
    const cmd = parseCommandLine('Just a regular log line', state);
    expect(cmd).toBeNull();
  });

  it('percent-encoded values are decoded', () => {
    const cmd = parseCommandLine('::set-output name=msg::hello%0Aworld%3A%2C', state);
    expect(cmd).not.toBeNull();
    expect(state.outputs.msg).toBe('hello\nworld:,');
  });

  it('parses ::notice:: annotation', () => {
    const cmd = parseCommandLine('::notice file=readme.md,line=1::Please update docs', state);
    expect(cmd).not.toBeNull();
    expect(state.annotations).toHaveLength(1);
    expect(state.annotations[0].level).toBe('notice');
    expect(state.annotations[0].file).toBe('readme.md');
  });

  it('parses ::save-state name=key::value', () => {
    const cmd = parseCommandLine('::save-state name=myState::stateValue', state);
    expect(cmd).not.toBeNull();
    expect(cmd!.command).toBe('save-state');
    expect(state.state.myState).toBe('stateValue');
  });

  it('set-output without name param does not crash', () => {
    const cmd = parseCommandLine('::set-output::value-without-name', state);
    expect(cmd).not.toBeNull();
    // No name param, so nothing should be set in outputs
    expect(Object.keys(state.outputs)).toHaveLength(0);
  });

  it('add-mask with empty message does not add mask', () => {
    const cmd = parseCommandLine('::add-mask::', state);
    expect(cmd).not.toBeNull();
    expect(state.masks).toHaveLength(0);
  });

  it('handles endLine and endColumn params', () => {
    const cmd = parseCommandLine('::error file=test.ts,line=10,col=5,endLine=12,endColumn=20::Multi-line error', state);
    expect(cmd).not.toBeNull();
    expect(state.annotations[0].line).toBe(10);
    expect(state.annotations[0].col).toBe(5);
    expect(state.annotations[0].endLine).toBe(12);
    expect(state.annotations[0].endColumn).toBe(20);
  });

  it('unknown command is returned but not processed specially', () => {
    const cmd = parseCommandLine('::custom-command param=val::message', state);
    expect(cmd).not.toBeNull();
    expect(cmd!.command).toBe('custom-command');
    expect(cmd!.params.param).toBe('val');
    expect(cmd!.message).toBe('message');
  });

  it('multiple set-output calls accumulate', () => {
    parseCommandLine('::set-output name=a::1', state);
    parseCommandLine('::set-output name=b::2', state);
    parseCommandLine('::set-output name=c::3', state);
    expect(state.outputs).toEqual({ a: '1', b: '2', c: '3' });
  });

  it('multiple masks accumulate', () => {
    parseCommandLine('::add-mask::secret1', state);
    parseCommandLine('::add-mask::secret2', state);
    expect(state.masks).toEqual(['secret1', 'secret2']);
  });
});

describe('processCommandOutput', () => {
  it('filters command lines and returns cleaned output', () => {
    const output = [
      'Building...',
      '::set-output name=result::ok',
      'Done!',
    ].join('\n');

    const filtered = processCommandOutput(output, state);
    expect(filtered).toContain('Building...');
    expect(filtered).toContain('Done!');
    // set-output should be stripped
    expect(filtered).not.toContain('::set-output');
    expect(state.outputs.result).toBe('ok');
  });

  it('applies masks to regular output', () => {
    // First add a mask
    parseCommandLine('::add-mask::my-password', state);

    const output = 'The password is my-password, do not share!';
    const filtered = processCommandOutput(output, state);
    expect(filtered).toContain('***');
    expect(filtered).not.toContain('my-password');
  });

  it('shows group/endgroup in output', () => {
    const output = [
      '::group::Install Dependencies',
      'npm install',
      '::endgroup::',
    ].join('\n');

    const filtered = processCommandOutput(output, state);
    expect(filtered).toContain('>> Install Dependencies');
    expect(filtered).toContain('<<');
    expect(filtered).toContain('npm install');
  });

  it('shows error/warning/notice/debug in output', () => {
    const output = [
      '::error::Something failed',
      '::warning::Deprecation',
      '::notice::FYI',
      '::debug::Verbose info',
    ].join('\n');

    const filtered = processCommandOutput(output, state);
    expect(filtered).toContain('Error: Something failed');
    expect(filtered).toContain('Warning: Deprecation');
    expect(filtered).toContain('Notice: FYI');
    expect(filtered).toContain('Debug: Verbose info');
  });

  it('preserves empty lines in output', () => {
    const output = 'line1\n\nline3';
    const filtered = processCommandOutput(output, state);
    expect(filtered).toBe('line1\n\nline3');
  });
});

describe('createCommandParserState', () => {
  it('returns a fresh state with empty collections', () => {
    const fresh = createCommandParserState();
    expect(fresh.outputs).toEqual({});
    expect(fresh.state).toEqual({});
    expect(fresh.masks).toEqual([]);
    expect(fresh.stopToken).toBeNull();
    expect(fresh.annotations).toEqual([]);
    expect(fresh.debugMessages).toEqual([]);
  });
});
