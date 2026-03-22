import { ExpressionContext } from '../types.js';

/**
 * Evaluate all ${{ expr }} placeholders in a string.
 * Returns the interpolated string with expressions resolved.
 */
export function evaluateExpression(template: string, ctx: ExpressionContext): string {
  if (typeof template !== 'string') return String(template ?? '');

  return template.replace(/\$\{\{\s*(.*?)\s*\}\}/g, (_match, expr: string) => {
    return String(evaluateSingle(expr.trim(), ctx));
  });
}

/**
 * Evaluate a single expression (the part inside ${{ }}).
 * Supports:
 *   - dotted property access: github.sha, env.FOO, steps.build.outputs.result
 *   - string literals: 'hello'
 *   - boolean/null: true, false, null
 *   - numeric literals: 42, 3.14
 *   - comparison operators: ==, !=, <, >, <=, >=
 *   - logical operators: &&, ||, !
 *   - functions: contains(), startsWith(), endsWith(), format(), toJSON(),
 *                success(), failure(), cancelled(), always(), hashFiles()
 */
export function evaluateSingle(expr: string, ctx: ExpressionContext): unknown {
  expr = expr.trim();

  // Logical NOT
  if (expr.startsWith('!')) {
    return !isTruthy(evaluateSingle(expr.slice(1), ctx));
  }

  // Logical OR
  const orParts = splitLogical(expr, '||');
  if (orParts.length > 1) {
    for (const part of orParts) {
      const val = evaluateSingle(part, ctx);
      if (isTruthy(val)) return val;
    }
    return false;
  }

  // Logical AND
  const andParts = splitLogical(expr, '&&');
  if (andParts.length > 1) {
    let last: unknown = true;
    for (const part of andParts) {
      last = evaluateSingle(part, ctx);
      if (!isTruthy(last)) return last;
    }
    return last;
  }

  // Comparison operators
  for (const op of ['==', '!=', '<=', '>=', '<', '>'] as const) {
    const idx = findOperator(expr, op);
    if (idx !== -1) {
      const left = evaluateSingle(expr.slice(0, idx), ctx);
      const right = evaluateSingle(expr.slice(idx + op.length), ctx);
      return compareValues(left, right, op);
    }
  }

  // Parenthesized expression
  if (expr.startsWith('(') && findClosingParen(expr, 0) === expr.length - 1) {
    return evaluateSingle(expr.slice(1, -1), ctx);
  }

  // String literal
  if ((expr.startsWith("'") && expr.endsWith("'")) || (expr.startsWith('"') && expr.endsWith('"'))) {
    return expr.slice(1, -1).replace(/''/g, "'");
  }

  // Numeric literal
  if (/^-?\d+(\.\d+)?$/.test(expr)) {
    return Number(expr);
  }

  // Boolean / null literals
  if (expr === 'true') return true;
  if (expr === 'false') return false;
  if (expr === 'null') return null;

  // Function calls
  const fnMatch = expr.match(/^(\w+)\s*\((.*)\)$/s);
  if (fnMatch) {
    const fnName = fnMatch[1].toLowerCase();
    const argsStr = fnMatch[2];
    return evaluateFunction(fnName, argsStr, ctx);
  }

  // Dotted property access: github.sha, steps.build.outputs.result, etc.
  return resolveDotted(expr, ctx);
}

function evaluateFunction(name: string, argsStr: string, ctx: ExpressionContext): unknown {
  const args = splitFunctionArgs(argsStr).map(a => evaluateSingle(a.trim(), ctx));

  switch (name) {
    case 'contains': {
      const haystack = String(args[0] ?? '').toLowerCase();
      const needle = String(args[1] ?? '').toLowerCase();
      return haystack.includes(needle);
    }
    case 'startswith': {
      const s = String(args[0] ?? '').toLowerCase();
      const prefix = String(args[1] ?? '').toLowerCase();
      return s.startsWith(prefix);
    }
    case 'endswith': {
      const s = String(args[0] ?? '').toLowerCase();
      const suffix = String(args[1] ?? '').toLowerCase();
      return s.endsWith(suffix);
    }
    case 'format': {
      let fmt = String(args[0] ?? '');
      for (let i = 1; i < args.length; i++) {
        fmt = fmt.replace(new RegExp(`\\{${i - 1}\\}`, 'g'), String(args[i] ?? ''));
      }
      return fmt;
    }
    case 'tojson':
      return JSON.stringify(args[0], null, 2);
    case 'fromjson':
      try { return JSON.parse(String(args[0])); } catch { return null; }
    case 'join': {
      const arr = Array.isArray(args[0]) ? args[0] : [args[0]];
      const sep = args.length > 1 ? String(args[1]) : ',';
      return arr.join(sep);
    }
    case 'success':
      return true; // default assumption in local runner
    case 'failure':
      return false;
    case 'cancelled':
      return false;
    case 'always':
      return true;
    case 'hashfiles':
      return 'local-hash-placeholder';
    default:
      return '';
  }
}

function resolveDotted(expr: string, ctx: ExpressionContext): unknown {
  const parts = expr.split('.');
  const root = parts[0];

  let current: unknown;

  if (root in ctx) {
    current = (ctx as unknown as Record<string, unknown>)[root];
  } else {
    return '';
  }

  for (let i = 1; i < parts.length; i++) {
    if (current == null || typeof current !== 'object') return '';
    const key = parts[i];
    // Support bracket-like access via dotted: steps.my-step.outputs.val
    current = (current as Record<string, unknown>)[key];
  }

  if (current === undefined) return '';
  return current;
}

/**
 * Evaluate an `if:` conditional. Returns true if the step/job should execute.
 */
export function evaluateCondition(condition: string | undefined, ctx: ExpressionContext): boolean {
  if (condition === undefined || condition === null) return true;

  let expr = String(condition).trim();

  // If the condition is not wrapped in ${{ }}, wrap it
  if (!expr.includes('${{')) {
    expr = `\${{ ${expr} }}`;
  }

  const result = evaluateExpression(expr, ctx);
  return isTruthy(result);
}

function isTruthy(val: unknown): boolean {
  if (val === null || val === undefined || val === '' || val === 0 || val === false || val === 'false') {
    return false;
  }
  return true;
}

function compareValues(left: unknown, right: unknown, op: string): boolean {
  // Coerce types for comparison
  const l = coerce(left);
  const r = coerce(right);

  switch (op) {
    case '==': return l == r;
    case '!=': return l != r;
    case '<': return Number(l) < Number(r);
    case '>': return Number(l) > Number(r);
    case '<=': return Number(l) <= Number(r);
    case '>=': return Number(l) >= Number(r);
    default: return false;
  }
}

function coerce(val: unknown): string | number | boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val;
  if (val === null || val === undefined) return '';
  return String(val);
}

/**
 * Split expression by a logical operator, respecting parentheses and string literals.
 */
function splitLogical(expr: string, op: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let current = '';

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];

    if (inString) {
      current += ch;
      if (ch === stringChar) inString = false;
      continue;
    }

    if (ch === "'" || ch === '"') {
      inString = true;
      stringChar = ch;
      current += ch;
      continue;
    }

    if (ch === '(') { depth++; current += ch; continue; }
    if (ch === ')') { depth--; current += ch; continue; }

    if (depth === 0 && expr.slice(i, i + op.length) === op) {
      parts.push(current.trim());
      current = '';
      i += op.length - 1;
      continue;
    }

    current += ch;
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
}

function findOperator(expr: string, op: string): number {
  let depth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];

    if (inString) {
      if (ch === stringChar) inString = false;
      continue;
    }

    if (ch === "'" || ch === '"') {
      inString = true;
      stringChar = ch;
      continue;
    }

    if (ch === '(') { depth++; continue; }
    if (ch === ')') { depth--; continue; }

    if (depth === 0 && expr.slice(i, i + op.length) === op) {
      // Make sure we don't confuse == with !=, <= with <, etc.
      if (op === '==' && i > 0 && expr[i - 1] === '!') continue;
      if (op === '<' && expr[i + 1] === '=') continue;
      if (op === '>' && expr[i + 1] === '=') continue;
      return i;
    }
  }

  return -1;
}

function findClosingParen(expr: string, start: number): number {
  let depth = 0;
  for (let i = start; i < expr.length; i++) {
    if (expr[i] === '(') depth++;
    if (expr[i] === ')') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

function splitFunctionArgs(argsStr: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let current = '';

  for (const ch of argsStr) {
    if (inString) {
      current += ch;
      if (ch === stringChar) inString = false;
      continue;
    }

    if (ch === "'" || ch === '"') {
      inString = true;
      stringChar = ch;
      current += ch;
      continue;
    }

    if (ch === '(') { depth++; current += ch; continue; }
    if (ch === ')') { depth--; current += ch; continue; }

    if (depth === 0 && ch === ',') {
      args.push(current);
      current = '';
      continue;
    }

    current += ch;
  }

  if (current.trim()) args.push(current);
  return args;
}
