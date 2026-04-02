/**
 * Detect basic syntax token types for lightweight coloring.
 * This is intentionally simple — not a full parser.
 */
export type TokenType = 'keyword' | 'string' | 'comment' | 'number' | 'plain';

const KEYWORDS = new Set([
  'import', 'export', 'from', 'default', 'const', 'let', 'var', 'function',
  'return', 'if', 'else', 'for', 'while', 'class', 'interface', 'type',
  'extends', 'implements', 'new', 'this', 'async', 'await', 'try', 'catch',
  'throw', 'typeof', 'instanceof', 'in', 'of', 'switch', 'case', 'break',
  'continue', 'do', 'yield', 'null', 'undefined', 'true', 'false', 'void',
  'static', 'public', 'private', 'protected', 'readonly', 'abstract',
  'enum', 'namespace', 'module', 'declare', 'as', 'is', 'keyof',
]);

export function isKeyword(word: string): boolean {
  return KEYWORDS.has(word);
}

export function detectLineType(content: string): TokenType {
  const trimmed = content.trim();
  if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
    return 'comment';
  }
  if (/^["'`]/.test(trimmed) || /^import\s/.test(trimmed)) {
    return 'string';
  }
  return 'plain';
}
