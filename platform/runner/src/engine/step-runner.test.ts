import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { parseKeyValueFile, maskSecrets } from './step-runner.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'step-runner-test-'));
});

afterEach(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* */ }
});

describe('parseKeyValueFile', () => {
  it('parses simple key=value', () => {
    const filePath = path.join(tmpDir, 'output');
    fs.writeFileSync(filePath, 'key=value');
    expect(parseKeyValueFile(filePath)).toEqual({ key: 'value' });
  });

  it('parses heredoc format', () => {
    const filePath = path.join(tmpDir, 'output');
    fs.writeFileSync(filePath, 'key<<EOF\nvalue line 1\nvalue line 2\nEOF');
    const result = parseKeyValueFile(filePath);
    expect(result.key).toBe('value line 1\nvalue line 2');
  });

  it('parses multiple entries', () => {
    const filePath = path.join(tmpDir, 'output');
    fs.writeFileSync(filePath, 'key1=value1\nkey2=value2\nkey3=value3');
    expect(parseKeyValueFile(filePath)).toEqual({
      key1: 'value1',
      key2: 'value2',
      key3: 'value3',
    });
  });

  it('returns empty object for empty file', () => {
    const filePath = path.join(tmpDir, 'output');
    fs.writeFileSync(filePath, '');
    expect(parseKeyValueFile(filePath)).toEqual({});
  });

  it('returns empty object for nonexistent file', () => {
    const filePath = path.join(tmpDir, 'nonexistent');
    expect(parseKeyValueFile(filePath)).toEqual({});
  });

  it('handles value containing = sign', () => {
    const filePath = path.join(tmpDir, 'output');
    fs.writeFileSync(filePath, 'url=https://example.com?a=1&b=2');
    const result = parseKeyValueFile(filePath);
    expect(result.url).toBe('https://example.com?a=1&b=2');
  });

  it('handles mixed simple and heredoc entries', () => {
    const filePath = path.join(tmpDir, 'output');
    fs.writeFileSync(filePath, 'simple=val\nmulti<<DELIM\nline1\nline2\nDELIM\nanother=thing');
    const result = parseKeyValueFile(filePath);
    expect(result.simple).toBe('val');
    expect(result.multi).toBe('line1\nline2');
    expect(result.another).toBe('thing');
  });

  it('handles whitespace-only file', () => {
    const filePath = path.join(tmpDir, 'output');
    fs.writeFileSync(filePath, '   \n  \n');
    expect(parseKeyValueFile(filePath)).toEqual({});
  });
});

describe('maskSecrets', () => {
  it('replaces secret values with ***', () => {
    expect(maskSecrets('my token is abc123', ['abc123'])).toBe('my token is ***');
  });

  it('handles special regex characters in secrets', () => {
    const secret = 'pass(word)+[special]';
    expect(maskSecrets(`the password is ${secret}`, [secret])).toBe('the password is ***');
  });

  it('returns text unchanged with empty secrets array', () => {
    expect(maskSecrets('nothing to mask', [])).toBe('nothing to mask');
  });

  it('masks multiple secrets', () => {
    const result = maskSecrets('token=abc key=xyz', ['abc', 'xyz']);
    expect(result).toBe('token=*** key=***');
  });

  it('masks multiple occurrences of the same secret', () => {
    expect(maskSecrets('abc and abc again', ['abc'])).toBe('*** and *** again');
  });

  it('does not mask empty strings', () => {
    expect(maskSecrets('hello world', [''])).toBe('hello world');
  });

  it('masks secrets that contain other secrets', () => {
    // The order matters here due to sequential replacement
    const result = maskSecrets('my-secret-value', ['my-secret-value']);
    expect(result).toBe('***');
  });

  it('handles text with no matches', () => {
    expect(maskSecrets('safe text', ['dangerous'])).toBe('safe text');
  });
});
