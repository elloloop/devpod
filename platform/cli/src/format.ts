import chalk from 'chalk';
import type { DiffStatus, ChangeType, FeatureData, DiffData } from './workspace';

export function statusIcon(status: string): string {
  switch (status) {
    case 'success':
    case 'completed':
    case 'connected':
    case 'active':
      return chalk.green('\u2713');
    case 'failure':
    case 'failed':
    case 'error':
      return chalk.red('\u2717');
    case 'cancelled':
    case 'canceled':
    case 'skipped':
      return chalk.gray('\u2298');
    case 'queued':
    case 'pending':
    case 'waiting':
      return chalk.yellow('\u23f3');
    case 'in_progress':
    case 'running':
      return chalk.blue('\u25b6');
    default:
      return chalk.dim('\u2022');
  }
}

export function statusColor(status: string): chalk.Chalk {
  switch (status) {
    case 'success':
    case 'completed':
      return chalk.green;
    case 'failure':
    case 'failed':
    case 'error':
      return chalk.red;
    case 'cancelled':
    case 'canceled':
    case 'skipped':
      return chalk.gray;
    case 'queued':
    case 'pending':
    case 'waiting':
      return chalk.yellow;
    case 'in_progress':
    case 'running':
      return chalk.blue;
    default:
      return chalk.white;
  }
}

export function relativeTime(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec} seconds ago`;
  if (diffMin === 1) return '1 minute ago';
  if (diffMin < 60) return `${diffMin} minutes ago`;
  if (diffHour === 1) return '1 hour ago';
  if (diffHour < 24) return `${diffHour} hours ago`;
  if (diffDay === 1) return '1 day ago';
  return `${diffDay} days ago`;
}

export function duration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const min = Math.floor(sec / 60);
  const remainSec = sec % 60;
  if (min < 60) return `${min}m ${remainSec.toFixed(0)}s`;
  const hr = Math.floor(min / 60);
  const remainMin = min % 60;
  return `${hr}h ${remainMin}m`;
}

export function table(
  rows: string[][],
  headers?: string[],
): string {
  const allRows = headers ? [headers, ...rows] : rows;
  if (allRows.length === 0) return '';

  const colCount = Math.max(...allRows.map((r) => r.length));
  const colWidths: number[] = [];

  for (let c = 0; c < colCount; c++) {
    colWidths[c] = 0;
    for (const row of allRows) {
      const cell = row[c] || '';
      // Strip ANSI codes for width calculation
      const stripped = cell.replace(
        // eslint-disable-next-line no-control-regex
        /\u001b\[[0-9;]*m/g,
        '',
      );
      colWidths[c] = Math.max(colWidths[c]!, stripped.length);
    }
  }

  const lines: string[] = [];

  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i]!;
    const cells = row.map((cell, c) => {
      const stripped = cell.replace(
        // eslint-disable-next-line no-control-regex
        /\u001b\[[0-9;]*m/g,
        '',
      );
      const padding = (colWidths[c] || 0) - stripped.length;
      return cell + ' '.repeat(Math.max(0, padding));
    });
    lines.push(cells.join('  '));

    // Add separator after headers
    if (i === 0 && headers) {
      const sep = colWidths.map((w) => '\u2500'.repeat(w));
      lines.push(chalk.dim(sep.join('  ')));
    }
  }

  return lines.join('\n');
}

export function indent(text: string, level: number = 1): string {
  const prefix = '  '.repeat(level);
  return text
    .split('\n')
    .map((line) => prefix + line)
    .join('\n');
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'ConnectionError') {
      return chalk.red(err.message);
    }
    return chalk.red(`Error: ${err.message}`);
  }
  return chalk.red(`Error: ${String(err)}`);
}

// ---------------------------------------------------------------------------
// Diff / Feature helpers
// ---------------------------------------------------------------------------

export function diffLabel(position: number): string {
  return `D${position}`;
}

export function diffStatusIcon(status: DiffStatus): string {
  switch (status) {
    case 'draft':     return '\u25cb';  // ○
    case 'submitted': return '\u25d1';  // ◑
    case 'approved':  return '\u2713';  // ✓
    case 'landed':    return '\u25cf';  // ●
    default:          return '\u2022';  // •
  }
}

export function featureTypePrefix(type: ChangeType): string {
  switch (type) {
    case 'feature': return 'feat';
    case 'fix':     return 'fix';
    case 'docs':    return 'docs';
    case 'chore':   return 'chore';
    default:        return 'feat';
  }
}

export function contextLine(feature: FeatureData | null, diff: DiffData | null): string {
  const parts: string[] = [];
  if (feature) parts.push(feature.branch || feature.slug);
  if (diff) parts.push(diffLabel(diff.position));
  return parts.join(' > ');
}

export function conflictMessage(file: string): string {
  return [
    `The file ${chalk.bold(file)} has conflicting changes.`,
    '',
    'To resolve:',
    `  1. Open ${chalk.cyan(file)} and look for conflict markers (<<<, ===, >>>)`,
    '  2. Keep the version you want and delete the markers',
    '  3. Save the file',
  ].join('\n');
}

export function nextStepHint(action: string): string {
  switch (action) {
    case 'diff':
      return chalk.dim('Run "devpod submit" to create a pull request, or "devpod diff" to add another change.');
    case 'sync':
      return chalk.dim('Your branch is up to date. Run "devpod diff" to continue working.');
    case 'edit':
      return chalk.dim('Run "devpod submit" to update the pull request with your edits.');
    case 'submit':
      return chalk.dim('Waiting for review. Run "devpod land" after approval to merge.');
    case 'land':
      return chalk.dim('Change landed. Run "devpod sync" to start fresh.');
    default:
      return '';
  }
}
