import { describe, it, expect } from 'vitest';
import { evaluateExpression, evaluateCondition, evaluateSingle } from './expression.js';
import { ExpressionContext } from '../types.js';

function makeCtx(overrides: Partial<ExpressionContext> = {}): ExpressionContext {
  return {
    github: {},
    env: {},
    inputs: {},
    steps: {},
    needs: {},
    jobs: {},
    runner: {},
    matrix: {},
    secrets: {},
    ...overrides,
  };
}

describe('evaluateExpression', () => {
  it('interpolates env variables', () => {
    const ctx = makeCtx({ env: { FOO: 'bar' } });
    expect(evaluateExpression('${{ env.FOO }}', ctx)).toBe('bar');
  });

  it('resolves dotted access into nested objects', () => {
    const ctx = makeCtx({
      steps: {
        build: {
          outputs: { result: 'ok' },
          outcome: 'success',
          conclusion: 'success',
        },
      },
    });
    expect(evaluateExpression('${{ steps.build.outputs.result }}', ctx)).toBe('ok');
  });

  it('resolves string literals', () => {
    const ctx = makeCtx();
    expect(evaluateExpression("${{ 'hello' }}", ctx)).toBe('hello');
  });

  it('resolves numeric literals', () => {
    const ctx = makeCtx();
    expect(evaluateExpression('${{ 42 }}', ctx)).toBe('42');
  });

  it('resolves boolean true', () => {
    const ctx = makeCtx();
    expect(evaluateExpression('${{ true }}', ctx)).toBe('true');
  });

  it('resolves boolean false', () => {
    const ctx = makeCtx();
    expect(evaluateExpression('${{ false }}', ctx)).toBe('false');
  });

  it('resolves equality comparison (==)', () => {
    const ctx = makeCtx();
    expect(evaluateExpression('${{ 1 == 1 }}', ctx)).toBe('true');
  });

  it('resolves inequality comparison (!=)', () => {
    const ctx = makeCtx();
    expect(evaluateExpression("${{ 'a' != 'b' }}", ctx)).toBe('true');
  });

  it('resolves logical AND', () => {
    const ctx = makeCtx();
    expect(evaluateExpression('${{ true && false }}', ctx)).toBe('false');
  });

  it('resolves logical OR', () => {
    const ctx = makeCtx();
    expect(evaluateExpression('${{ false || true }}', ctx)).toBe('true');
  });

  it('resolves logical NOT', () => {
    const ctx = makeCtx();
    expect(evaluateExpression('${{ !false }}', ctx)).toBe('true');
  });

  it('resolves contains() function', () => {
    const ctx = makeCtx();
    expect(evaluateExpression("${{ contains('hello world', 'hello') }}", ctx)).toBe('true');
  });

  it('resolves startsWith() function', () => {
    const ctx = makeCtx();
    expect(evaluateExpression("${{ startsWith('hello', 'hel') }}", ctx)).toBe('true');
  });

  it('resolves endsWith() function', () => {
    const ctx = makeCtx();
    expect(evaluateExpression("${{ endsWith('hello', 'llo') }}", ctx)).toBe('true');
  });

  it('resolves format() function', () => {
    const ctx = makeCtx();
    expect(evaluateExpression("${{ format('{0}-{1}', 'a', 'b') }}", ctx)).toBe('a-b');
  });

  it('resolves toJSON() function', () => {
    const ctx = makeCtx({ env: { a: '1' } });
    const result = evaluateExpression('${{ toJSON(env) }}', ctx);
    expect(JSON.parse(result)).toEqual({ a: '1' });
  });

  it('resolves success() function', () => {
    const ctx = makeCtx();
    expect(evaluateExpression('${{ success() }}', ctx)).toBe('true');
  });

  it('resolves failure() function', () => {
    const ctx = makeCtx();
    expect(evaluateExpression('${{ failure() }}', ctx)).toBe('false');
  });

  it('returns empty string for missing context', () => {
    const ctx = makeCtx();
    expect(evaluateExpression('${{ env.MISSING }}', ctx)).toBe('');
  });

  it('interpolates multiple expressions in one string', () => {
    const ctx = makeCtx({ matrix: { version: '18', os: 'linux' } });
    expect(evaluateExpression('v${{ matrix.version }}-${{ matrix.os }}', ctx)).toBe('v18-linux');
  });

  it('handles nested parentheses', () => {
    const ctx = makeCtx();
    expect(evaluateExpression('${{ (1 == 1) && (2 == 2) }}', ctx)).toBe('true');
  });

  it('returns empty string for empty expression', () => {
    const ctx = makeCtx();
    expect(evaluateExpression('${{ }}', ctx)).toBe('');
  });

  it('returns non-string input as string', () => {
    const ctx = makeCtx();
    expect(evaluateExpression(123 as unknown as string, ctx)).toBe('123');
  });

  it('returns empty string for null/undefined input', () => {
    const ctx = makeCtx();
    expect(evaluateExpression(null as unknown as string, ctx)).toBe('');
    expect(evaluateExpression(undefined as unknown as string, ctx)).toBe('');
  });

  it('passes through string with no expressions', () => {
    const ctx = makeCtx();
    expect(evaluateExpression('hello world', ctx)).toBe('hello world');
  });

  it('resolves cancelled() function', () => {
    const ctx = makeCtx();
    expect(evaluateExpression('${{ cancelled() }}', ctx)).toBe('false');
  });

  it('resolves always() function', () => {
    const ctx = makeCtx();
    expect(evaluateExpression('${{ always() }}', ctx)).toBe('true');
  });

  it('resolves hashFiles() function', () => {
    const ctx = makeCtx();
    expect(evaluateExpression("${{ hashFiles('**/*.lock') }}", ctx)).toBe('local-hash-placeholder');
  });

  it('resolves less than comparison', () => {
    const ctx = makeCtx();
    expect(evaluateSingle('1 < 2', ctx)).toBe(true);
  });

  it('resolves greater than comparison', () => {
    const ctx = makeCtx();
    expect(evaluateSingle('3 > 2', ctx)).toBe(true);
  });

  it('resolves <= comparison', () => {
    const ctx = makeCtx();
    expect(evaluateSingle('2 <= 2', ctx)).toBe(true);
  });

  it('resolves >= comparison', () => {
    const ctx = makeCtx();
    expect(evaluateSingle('3 >= 2', ctx)).toBe(true);
  });

  it('resolves null literal', () => {
    const ctx = makeCtx();
    expect(evaluateSingle('null', ctx)).toBe(null);
  });

  it('resolves join() function', () => {
    const ctx = makeCtx();
    // join on a non-array wraps it
    expect(evaluateSingle("join('a', '-')", ctx)).toBe('a');
  });

  it('resolves fromjson() function', () => {
    const ctx = makeCtx();
    expect(evaluateSingle("fromjson('{\"x\":1}')", ctx)).toEqual({ x: 1 });
  });

  it('fromjson returns null on invalid JSON', () => {
    const ctx = makeCtx();
    expect(evaluateSingle("fromjson('not-json')", ctx)).toBe(null);
  });

  it('returns empty string for unknown function', () => {
    const ctx = makeCtx();
    expect(evaluateSingle("unknownFn('a')", ctx)).toBe('');
  });

  // ── Edge cases: nested function calls ──

  it('evaluates nested function calls: contains(format(...), ...)', () => {
    const ctx = makeCtx();
    expect(evaluateExpression("${{ contains(format('{0}', 'hello'), 'ello') }}", ctx)).toBe('true');
  });

  it('evaluates nested function calls: startsWith(format(...), ...)', () => {
    const ctx = makeCtx();
    expect(evaluateExpression("${{ startsWith(format('{0}-{1}', 'abc', 'def'), 'abc') }}", ctx)).toBe('true');
  });

  // ── Edge cases: deeply nested property access ──

  it('resolves deeply nested property access: github.event.pull_request.head.sha', () => {
    const ctx = makeCtx({
      github: {
        event: {
          pull_request: {
            head: {
              sha: 'abc123def456',
            },
          },
        },
      },
    });
    expect(evaluateExpression('${{ github.event.pull_request.head.sha }}', ctx)).toBe('abc123def456');
  });

  it('returns empty string for very long dotted path that does not exist', () => {
    const ctx = makeCtx();
    expect(evaluateExpression('${{ github.event.pull_request.head.sha.foo.bar }}', ctx)).toBe('');
  });

  it('returns empty string for dotted path through non-object', () => {
    const ctx = makeCtx({ env: { FOO: 'bar' } });
    expect(evaluateExpression('${{ env.FOO.baz }}', ctx)).toBe('');
  });

  // ── Edge cases: type coercion in comparisons ──

  it('compares string and number with type coercion: \'42\' == 42', () => {
    const ctx = makeCtx();
    expect(evaluateExpression("${{ '42' == 42 }}", ctx)).toBe('true');
  });

  it('empty string equals false', () => {
    const ctx = makeCtx();
    // '' == false should be true due to JS loose equality
    expect(evaluateSingle("'' == false", ctx)).toBe(true);
  });

  // ── Edge cases: ternary-like patterns ──

  it('evaluates ternary-like pattern: success() && \'yes\' || \'no\'', () => {
    const ctx = makeCtx();
    // success() is true, so true && 'yes' returns 'yes', which is truthy
    expect(evaluateExpression("${{ success() && 'yes' || 'no' }}", ctx)).toBe('yes');
  });

  it('evaluates ternary-like pattern when false: failure() && \'yes\' || \'no\'', () => {
    const ctx = makeCtx();
    // failure() is false, so false && 'yes' returns false, then false || 'no' returns 'no'
    expect(evaluateExpression("${{ failure() && 'yes' || 'no' }}", ctx)).toBe('no');
  });

  // ── Edge cases: escaped quotes in strings ──

  it('handles escaped quotes in strings: it\'\'s', () => {
    const ctx = makeCtx();
    expect(evaluateExpression("${{ 'it''s' }}", ctx)).toBe("it's");
  });

  // ── Edge cases: multiple expressions in one string with surrounding text ──

  it('interpolates multiple expressions with surrounding text', () => {
    const ctx = makeCtx({ env: { USER: 'alice', HOST: 'example.com' } });
    expect(evaluateExpression('Hello ${{ env.USER }}@${{ env.HOST }}!', ctx)).toBe('Hello alice@example.com!');
  });

  // ── Edge cases: expression with no spaces ──

  it('handles expression with no spaces: ${{env.FOO}}', () => {
    const ctx = makeCtx({ env: { FOO: 'bar' } });
    expect(evaluateExpression('${{env.FOO}}', ctx)).toBe('bar');
  });

  // ── Edge cases: join with array ──

  it('resolves join() on an array', () => {
    const ctx = makeCtx({
      github: { event: { labels: ['bug', 'urgent', 'p1'] } },
    });
    expect(evaluateSingle("join(github.event.labels, ', ')", ctx)).toBe('bug, urgent, p1');
  });

  // ── Edge cases: toJSON on nested objects ──

  it('resolves toJSON() on nested object', () => {
    const ctx = makeCtx({ matrix: { os: 'linux', version: '20' } });
    const result = evaluateExpression('${{ toJSON(matrix) }}', ctx);
    expect(JSON.parse(result)).toEqual({ os: 'linux', version: '20' });
  });

  // ── Edge cases: comparison operators edge values ──

  it('less-than with equal values returns false', () => {
    const ctx = makeCtx();
    expect(evaluateSingle('2 < 2', ctx)).toBe(false);
  });

  it('greater-than with equal values returns false', () => {
    const ctx = makeCtx();
    expect(evaluateSingle('2 > 2', ctx)).toBe(false);
  });

  it('equality of true and true', () => {
    const ctx = makeCtx();
    expect(evaluateSingle('true == true', ctx)).toBe(true);
  });

  it('inequality of true and false', () => {
    const ctx = makeCtx();
    expect(evaluateSingle('true != false', ctx)).toBe(true);
  });

  // ── Edge cases: unknown context root ──

  it('returns empty string for unknown context root', () => {
    const ctx = makeCtx();
    expect(evaluateExpression('${{ nonexistent.foo }}', ctx)).toBe('');
  });

  // ── Edge cases: fromjson with object containing nested arrays ──

  it('fromjson handles complex JSON', () => {
    const ctx = makeCtx();
    expect(evaluateSingle('fromjson(\'{"a":[1,2,3]}\')', ctx)).toEqual({ a: [1, 2, 3] });
  });

  // ── Edge cases: format with more/fewer placeholders ──

  it('format with unused placeholder leaves it', () => {
    const ctx = makeCtx();
    expect(evaluateExpression("${{ format('{0}-{1}-{2}', 'a', 'b') }}", ctx)).toBe('a-b-{2}');
  });

  it('format with extra arguments ignores them', () => {
    const ctx = makeCtx();
    expect(evaluateExpression("${{ format('{0}', 'a', 'b', 'c') }}", ctx)).toBe('a');
  });
});

describe('evaluateCondition', () => {
  it('returns true when condition is undefined (default run)', () => {
    const ctx = makeCtx();
    expect(evaluateCondition(undefined, ctx)).toBe(true);
  });

  it('returns true when condition is null', () => {
    const ctx = makeCtx();
    expect(evaluateCondition(null as unknown as undefined, ctx)).toBe(true);
  });

  it('evaluates "true" string to true', () => {
    const ctx = makeCtx();
    expect(evaluateCondition('true', ctx)).toBe(true);
  });

  it('evaluates "false" string to false', () => {
    const ctx = makeCtx();
    expect(evaluateCondition('false', ctx)).toBe(false);
  });

  it('evaluates context-dependent condition', () => {
    const ctx = makeCtx({
      steps: {
        build: {
          outputs: { 'cache-hit': 'true' },
          outcome: 'success',
          conclusion: 'success',
        },
      },
    });
    expect(evaluateCondition("steps.build.outputs.cache-hit == 'true'", ctx)).toBe(true);
  });

  it('evaluates context-dependent condition to false', () => {
    const ctx = makeCtx({
      steps: {
        build: {
          outputs: { 'cache-hit': 'false' },
          outcome: 'success',
          conclusion: 'success',
        },
      },
    });
    expect(evaluateCondition("steps.build.outputs.cache-hit == 'true'", ctx)).toBe(false);
  });

  it('evaluates ${{ success() }} to true', () => {
    const ctx = makeCtx();
    expect(evaluateCondition('${{ success() }}', ctx)).toBe(true);
  });

  it('evaluates failure() to false', () => {
    const ctx = makeCtx();
    expect(evaluateCondition('failure()', ctx)).toBe(false);
  });

  it('evaluates combined condition with &&', () => {
    const ctx = makeCtx();
    expect(evaluateCondition('true && true', ctx)).toBe(true);
    expect(evaluateCondition('true && false', ctx)).toBe(false);
  });

  it('evaluates combined condition with ||', () => {
    const ctx = makeCtx();
    expect(evaluateCondition('false || true', ctx)).toBe(true);
  });

  it('evaluates always() to true', () => {
    const ctx = makeCtx();
    expect(evaluateCondition('always()', ctx)).toBe(true);
  });

  it('evaluates negation', () => {
    const ctx = makeCtx();
    expect(evaluateCondition('!failure()', ctx)).toBe(true);
  });
});
