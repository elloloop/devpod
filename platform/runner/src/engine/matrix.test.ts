import { describe, it, expect } from 'vitest';
import { expandMatrix, matrixLabel, MatrixStrategy } from './matrix.js';

describe('expandMatrix', () => {
  it('expands a simple 1D matrix', () => {
    const strategy: MatrixStrategy = {
      matrix: { version: [18, 20, 22] },
    };
    const result = expandMatrix(strategy);
    expect(result).toHaveLength(3);
    expect(result).toEqual([
      { version: '18' },
      { version: '20' },
      { version: '22' },
    ]);
  });

  it('expands a 2D cartesian product', () => {
    const strategy: MatrixStrategy = {
      matrix: { version: [18, 20], os: ['linux', 'mac'] },
    };
    const result = expandMatrix(strategy);
    expect(result).toHaveLength(4);
    // All combinations should be present
    expect(result).toContainEqual({ version: '18', os: 'linux' });
    expect(result).toContainEqual({ version: '18', os: 'mac' });
    expect(result).toContainEqual({ version: '20', os: 'linux' });
    expect(result).toContainEqual({ version: '20', os: 'mac' });
  });

  it('expands a 3D matrix correctly', () => {
    const strategy: MatrixStrategy = {
      matrix: {
        version: [18, 20],
        os: ['linux', 'mac'],
        arch: ['x64', 'arm64'],
      },
    };
    const result = expandMatrix(strategy);
    expect(result).toHaveLength(8);
    expect(result).toContainEqual({ version: '18', os: 'linux', arch: 'x64' });
    expect(result).toContainEqual({ version: '20', os: 'mac', arch: 'arm64' });
  });

  it('applies exclude to remove matching combinations', () => {
    const strategy: MatrixStrategy = {
      matrix: {
        version: [18, 20],
        os: ['linux', 'mac'],
        exclude: [{ version: 18, os: 'mac' }],
      },
    };
    const result = expandMatrix(strategy);
    expect(result).toHaveLength(3);
    expect(result).not.toContainEqual({ version: '18', os: 'mac' });
  });

  it('applies include to add extra combinations', () => {
    const strategy: MatrixStrategy = {
      matrix: {
        version: [18, 20],
        include: [{ version: 22, os: 'linux' }],
      },
    };
    const result = expandMatrix(strategy);
    // 2 from base + 1 from include
    expect(result).toHaveLength(3);
    expect(result).toContainEqual({ version: '22', os: 'linux' });
  });

  it('merges include properties into matching combinations', () => {
    const strategy: MatrixStrategy = {
      matrix: {
        version: [18, 20],
        os: ['linux'],
        include: [{ version: 18, os: 'linux', experimental: true }],
      },
    };
    const result = expandMatrix(strategy);
    expect(result).toHaveLength(2);
    const v18 = result.find(r => r.version === '18');
    expect(v18).toBeDefined();
    expect(v18!.experimental).toBe('true');
  });

  it('returns empty array for empty matrix', () => {
    const strategy: MatrixStrategy = {
      matrix: {} as Record<string, unknown[]>,
    };
    const result = expandMatrix(strategy);
    expect(result).toEqual([]);
  });

  it('handles single-value arrays', () => {
    const strategy: MatrixStrategy = {
      matrix: { version: [18] },
    };
    const result = expandMatrix(strategy);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ version: '18' });
  });

  it('stringifies all values', () => {
    const strategy: MatrixStrategy = {
      matrix: { version: [18], flag: [true] },
    };
    const result = expandMatrix(strategy);
    expect(result).toHaveLength(1);
    expect(result[0].version).toBe('18');
    expect(result[0].flag).toBe('true');
  });

  it('include-only matrix adds combinations (plus the initial empty combo)', () => {
    const strategy: MatrixStrategy = {
      matrix: {
        include: [
          { version: 18, os: 'linux' },
          { version: 20, os: 'mac' },
        ],
      } as Record<string, unknown[]> & { include?: Record<string, unknown>[] },
    };
    const result = expandMatrix(strategy);
    // When there are no base matrix keys, the initial empty {} combo remains
    // alongside the included entries (3 total)
    expect(result).toHaveLength(3);
    expect(result).toContainEqual({ version: '18', os: 'linux' });
    expect(result).toContainEqual({ version: '20', os: 'mac' });
  });
});

describe('matrixLabel', () => {
  it('formats a multi-value combination', () => {
    expect(matrixLabel({ version: '18', os: 'linux' })).toBe('(18, linux)');
  });

  it('formats a single-value combination', () => {
    expect(matrixLabel({ version: '18' })).toBe('(18)');
  });

  it('returns empty string for empty combination', () => {
    expect(matrixLabel({})).toBe('');
  });

  it('formats three values', () => {
    expect(matrixLabel({ a: '1', b: '2', c: '3' })).toBe('(1, 2, 3)');
  });
});

describe('expandMatrix edge cases', () => {
  it('exclude that removes ALL combinations returns empty array', () => {
    const strategy: MatrixStrategy = {
      matrix: {
        version: [18],
        os: ['linux'],
        exclude: [{ version: 18, os: 'linux' }],
      },
    };
    const result = expandMatrix(strategy);
    expect(result).toEqual([]);
  });

  it('include adds a combination with a key not in the base matrix', () => {
    const strategy: MatrixStrategy = {
      matrix: {
        version: [18, 20],
        include: [{ version: 18, experimental: true }],
      },
    };
    const result = expandMatrix(strategy);
    // version 18 should have the extra 'experimental' key merged
    const v18 = result.find(r => r.version === '18');
    expect(v18).toBeDefined();
    expect(v18!.experimental).toBe('true');
    // version 20 should not
    const v20 = result.find(r => r.version === '20');
    expect(v20).toBeDefined();
    expect(v20!.experimental).toBeUndefined();
  });

  it('matrix with boolean values stringifies them', () => {
    const strategy: MatrixStrategy = {
      matrix: { debug: [true, false] },
    };
    const result = expandMatrix(strategy);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ debug: 'true' });
    expect(result).toContainEqual({ debug: 'false' });
  });

  it('matrix with mixed types (string, number)', () => {
    const strategy: MatrixStrategy = {
      matrix: { val: ['hello', 42, true] },
    };
    const result = expandMatrix(strategy);
    expect(result).toHaveLength(3);
    expect(result).toContainEqual({ val: 'hello' });
    expect(result).toContainEqual({ val: '42' });
    expect(result).toContainEqual({ val: 'true' });
  });

  it('large matrix 5x5x5 = 125 combinations', () => {
    const strategy: MatrixStrategy = {
      matrix: {
        a: [1, 2, 3, 4, 5],
        b: [1, 2, 3, 4, 5],
        c: [1, 2, 3, 4, 5],
      },
    };
    const result = expandMatrix(strategy);
    expect(result).toHaveLength(125);
    // Spot-check a specific combination
    expect(result).toContainEqual({ a: '3', b: '4', c: '5' });
  });

  it('exclude with partial match (only some keys specified)', () => {
    const strategy: MatrixStrategy = {
      matrix: {
        version: [18, 20],
        os: ['linux', 'mac'],
        arch: ['x64', 'arm64'],
        // Exclude all version=18 + os=mac, regardless of arch
        exclude: [{ version: 18, os: 'mac' }],
      },
    };
    const result = expandMatrix(strategy);
    // Total: 2*2*2 = 8, minus 2 excluded (version=18, os=mac, any arch)
    expect(result).toHaveLength(6);
    expect(result).not.toContainEqual({ version: '18', os: 'mac', arch: 'x64' });
    expect(result).not.toContainEqual({ version: '18', os: 'mac', arch: 'arm64' });
  });

  it('include with entirely new key set not in base', () => {
    const strategy: MatrixStrategy = {
      matrix: {
        version: [18, 20],
        include: [{ platform: 'windows', arch: 'arm64' }],
      },
    };
    const result = expandMatrix(strategy);
    // 2 from base + 1 new combo from include
    expect(result).toHaveLength(3);
    expect(result).toContainEqual({ platform: 'windows', arch: 'arm64' });
  });

  it('multiple excludes remove multiple combinations', () => {
    const strategy: MatrixStrategy = {
      matrix: {
        a: [1, 2, 3],
        b: [1, 2, 3],
        exclude: [
          { a: 1, b: 1 },
          { a: 2, b: 2 },
          { a: 3, b: 3 },
        ],
      },
    };
    const result = expandMatrix(strategy);
    // 3*3=9 minus 3 diagonal = 6
    expect(result).toHaveLength(6);
  });
});
