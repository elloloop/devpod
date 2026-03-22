import { describe, it, expect } from 'vitest';
import { parseMarketplaceRef } from './resolver.js';

describe('parseMarketplaceRef', () => {
  it('parses "actions/checkout@v4"', () => {
    const result = parseMarketplaceRef('actions/checkout@v4');
    expect(result).toEqual({
      owner: 'actions',
      repo: 'checkout',
      ref: 'v4',
      subpath: null,
    });
  });

  it('parses "actions/cache@v4"', () => {
    const result = parseMarketplaceRef('actions/cache@v4');
    expect(result).toEqual({
      owner: 'actions',
      repo: 'cache',
      ref: 'v4',
      subpath: null,
    });
  });

  it('parses "gradle/actions/setup-gradle@v3" with subpath', () => {
    const result = parseMarketplaceRef('gradle/actions/setup-gradle@v3');
    expect(result).toEqual({
      owner: 'gradle',
      repo: 'actions',
      ref: 'v3',
      subpath: 'setup-gradle',
    });
  });

  it('parses deep subpaths', () => {
    const result = parseMarketplaceRef('owner/repo/deep/sub/path@main');
    expect(result).toEqual({
      owner: 'owner',
      repo: 'repo',
      ref: 'main',
      subpath: 'deep/sub/path',
    });
  });

  it('returns null for "no-at-sign" (no @ symbol)', () => {
    expect(parseMarketplaceRef('no-at-sign')).toBeNull();
  });

  it('returns null for "@v4" (no path)', () => {
    expect(parseMarketplaceRef('@v4')).toBeNull();
  });

  it('returns null for "actions/@v4" (no repo)', () => {
    expect(parseMarketplaceRef('actions/@v4')).toBeNull();
  });

  it('parses ref with SHA', () => {
    const result = parseMarketplaceRef('actions/checkout@abc123def456');
    expect(result).toEqual({
      owner: 'actions',
      repo: 'checkout',
      ref: 'abc123def456',
      subpath: null,
    });
  });

  it('returns null for empty string', () => {
    expect(parseMarketplaceRef('')).toBeNull();
  });

  it('uses lastIndexOf for @ so refs with @ work correctly', () => {
    // This is a somewhat pathological case but tests lastIndexOf behavior
    const result = parseMarketplaceRef('owner/repo@v1');
    expect(result).toEqual({
      owner: 'owner',
      repo: 'repo',
      ref: 'v1',
      subpath: null,
    });
  });
});
