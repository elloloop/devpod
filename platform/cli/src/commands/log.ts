import { Command } from 'commander';
import chalk from 'chalk';
import {
  listFeatures,
  loadDiffsForFeature,
  listUndoEntries,
} from '../workspace';
import { errorMessage, diffLabel } from '../format';

interface LogEvent {
  timestamp: string;
  message: string;
}

function formatTime(date: string): string {
  const d = new Date(date);
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatDateHeader(date: string): string {
  const d = new Date(date);
  const now = new Date();

  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const nDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor(
    (nDay.getTime() - dDay.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function getDateKey(date: string): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

export function registerLogCommand(program: Command): void {
  program
    .command('log')
    .description('Show activity log')
    .option('-n, --limit <n>', 'Number of entries to show', '20')
    .action(async (opts: { limit: string }) => {
      try {
        const limit = parseInt(opts.limit, 10) || 20;
        const events: LogEvent[] = [];

        // Collect events from features
        const features = listFeatures();
        for (const feature of features) {
          events.push({
            timestamp: feature.created,
            message: `Started feature: ${feature.name}`,
          });

          // Collect from diffs
          const diffs = loadDiffsForFeature(feature);
          for (const d of diffs) {
            events.push({
              timestamp: d.created,
              message: `Created diff ${diffLabel(d.position)}: ${d.title}`,
            });

            if (d.status === 'landed') {
              events.push({
                timestamp: d.updated,
                message: `Landed: ${d.title}`,
              });
            } else if (d.status === 'submitted') {
              events.push({
                timestamp: d.updated,
                message: `Submitted ${diffLabel(d.position)}: ${d.title}`,
              });
            }
          }
        }

        // Collect from undo entries
        const undoEntries = listUndoEntries();
        for (const entry of undoEntries) {
          if (entry.action === 'sync') {
            events.push({
              timestamp: entry.timestamp,
              message: `Synced: ${entry.description}`,
            });
          }
        }

        // Sort by timestamp descending
        events.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() -
            new Date(a.timestamp).getTime(),
        );

        // Deduplicate and limit
        const seen = new Set<string>();
        const uniqueEvents: LogEvent[] = [];
        for (const event of events) {
          const key = `${event.timestamp}:${event.message}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueEvents.push(event);
          }
          if (uniqueEvents.length >= limit) break;
        }

        if (uniqueEvents.length === 0) {
          console.log(chalk.dim('No activity yet.'));
          return;
        }

        // Group by day
        const groups = new Map<string, LogEvent[]>();
        for (const event of uniqueEvents) {
          const key = getDateKey(event.timestamp);
          if (!groups.has(key)) {
            groups.set(key, []);
          }
          groups.get(key)!.push(event);
        }

        for (const [dateKey, dayEvents] of groups) {
          const header = formatDateHeader(dayEvents[0]!.timestamp);
          console.log(chalk.bold(header));

          for (const event of dayEvents) {
            const time = formatTime(event.timestamp);
            console.log(
              `  ${chalk.dim(time)}  ${event.message}`,
            );
          }
          console.log();
        }
      } catch (err) {
        console.error(errorMessage(err));
        process.exit(1);
      }
    });
}
