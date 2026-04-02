import type { DiffHunk, DiffLine } from './types';

/**
 * Parse a unified diff string for a single file into structured hunks.
 */
export function parseUnifiedDiff(diff: string): DiffHunk[] {
  if (!diff) return [];

  const hunks: DiffHunk[] = [];
  const lines = diff.split('\n');
  let currentHunk: DiffHunk | null = null;
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    // Skip diff metadata headers
    if (line.startsWith('diff --git')) continue;
    if (line.startsWith('index ')) continue;
    if (line.startsWith('--- ')) continue;
    if (line.startsWith('+++ ')) continue;
    if (line.startsWith('old mode') || line.startsWith('new mode')) continue;
    if (line.startsWith('new file') || line.startsWith('deleted file')) continue;
    if (line.startsWith('similarity index') || line.startsWith('rename ')) continue;

    if (line.startsWith('Binary files')) {
      hunks.push({
        header: 'Binary file changed',
        oldStart: 0,
        oldCount: 0,
        newStart: 0,
        newCount: 0,
        context: '',
        lines: [{ type: 'header', content: 'Binary file changed' }],
      });
      continue;
    }

    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[3], 10);
        const ctxText = match[5]?.trim() || '';

        currentHunk = {
          header: line,
          oldStart: oldLine,
          oldCount: match[2] ? parseInt(match[2], 10) : 1,
          newStart: newLine,
          newCount: match[4] ? parseInt(match[4], 10) : 1,
          context: ctxText,
          lines: [],
        };

        if (ctxText) {
          currentHunk.lines.push({ type: 'header', content: ctxText });
        }

        hunks.push(currentHunk);
      }
      continue;
    }

    if (!currentHunk) continue;

    if (line.startsWith('+')) {
      currentHunk.lines.push({
        type: 'add',
        content: line.substring(1),
        newNumber: newLine++,
      });
    } else if (line.startsWith('-')) {
      currentHunk.lines.push({
        type: 'remove',
        content: line.substring(1),
        oldNumber: oldLine++,
      });
    } else if (line.startsWith(' ') || line === '') {
      currentHunk.lines.push({
        type: 'context',
        content: line.substring(1) || '',
        oldNumber: oldLine++,
        newNumber: newLine++,
      });
    }
  }

  return hunks;
}
