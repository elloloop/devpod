"use client";

import { useState, useEffect, useCallback } from 'react';
import { useDiffVersions } from '@/packages/git-client';
import type { DiffVersionInfo } from '@/packages/git-client';

interface VersionHistoryProps {
  slug: string;
  position: number;
  currentVersion: number;
  onCompare: (left: string, right: string, leftLabel: string, rightLabel: string) => void;
}

const actionColor: Record<string, string> = {
  create: 'var(--dp-accent-success)',
  update: 'var(--dp-accent-info)',
  undo: 'var(--dp-accent-warning)',
};

function relativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function VersionHistory({ slug, position, currentVersion, onCompare }: VersionHistoryProps) {
  const [expanded, setExpanded] = useState(false);
  const { data: versions, isLoading } = useDiffVersions(slug, position);

  // Keyboard: v to toggle
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'v') {
        e.preventDefault();
        setExpanded((prev) => !prev);
      }
    },
    []
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (isLoading || !versions || versions.length === 0) return null;

  const sorted = [...versions].sort((a, b) => b.version - a.version);
  const latest = sorted[0];

  return (
    <div
      style={{
        borderBottom: '1px solid var(--dp-border-subtle)',
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 w-full px-2 hover:bg-[var(--dp-bg-hover)] transition-colors"
        style={{
          height: '24px',
          fontFamily: 'var(--dp-font-mono)',
          fontSize: 'var(--dp-font-xs)',
          color: 'var(--dp-text-tertiary)',
        }}
      >
        <span style={{ fontSize: '9px' }}>{expanded ? '\u25BE' : '\u25B8'}</span>
        <span>Version History</span>
        <span
          className="px-1 rounded"
          style={{
            fontSize: '10px',
            backgroundColor: 'rgba(99, 102, 241, 0.12)',
            color: 'var(--dp-accent-primary)',
          }}
        >
          {versions.length} {versions.length === 1 ? 'version' : 'versions'}
        </span>
        <span className="ml-auto opacity-50" style={{ fontSize: '10px' }}>v</span>
      </button>

      {expanded && (
        <div className="pb-1">
          {sorted.map((ver) => {
            const isCurrent = ver.version === currentVersion;

            return (
              <div
                key={ver.snapshotId}
                className="flex items-center gap-1.5 px-2"
                style={{
                  lineHeight: 'var(--dp-lh-compact)',
                  fontFamily: 'var(--dp-font-mono)',
                  fontSize: 'var(--dp-font-xs)',
                  backgroundColor: isCurrent ? 'rgba(99, 102, 241, 0.06)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isCurrent) e.currentTarget.style.backgroundColor = 'var(--dp-bg-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!isCurrent) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {/* Version number */}
                <span
                  className="shrink-0 font-bold"
                  style={{
                    width: '24px',
                    color: isCurrent ? 'var(--dp-accent-primary)' : 'var(--dp-text-primary)',
                  }}
                >
                  v{ver.version}
                </span>

                {/* Date */}
                <span
                  className="shrink-0"
                  style={{
                    width: '60px',
                    color: 'var(--dp-text-tertiary)',
                    fontSize: '10px',
                  }}
                >
                  {relativeTime(ver.date)}
                </span>

                {/* Message */}
                <span
                  className="truncate min-w-0 flex-1"
                  style={{ color: 'var(--dp-text-secondary)' }}
                >
                  {ver.message}
                </span>

                {/* Action badge */}
                <span
                  className="shrink-0 px-1 rounded"
                  style={{
                    fontSize: '10px',
                    color: actionColor[ver.action] || 'var(--dp-text-tertiary)',
                    backgroundColor:
                      ver.action === 'create'
                        ? 'rgba(34, 197, 94, 0.1)'
                        : ver.action === 'update'
                          ? 'rgba(59, 130, 246, 0.1)'
                          : 'rgba(245, 158, 11, 0.1)',
                  }}
                >
                  {ver.action}
                </span>

                {/* Current indicator */}
                {isCurrent && (
                  <span
                    className="shrink-0 px-1 rounded"
                    style={{
                      fontSize: '10px',
                      color: 'var(--dp-accent-primary)',
                      backgroundColor: 'rgba(99, 102, 241, 0.12)',
                    }}
                  >
                    current
                  </span>
                )}

                {/* Compare link — compare this version to current */}
                {!isCurrent && latest && (
                  <button
                    className="shrink-0 px-1 rounded hover:bg-[var(--dp-bg-active)] transition-colors"
                    style={{
                      fontSize: '10px',
                      color: 'var(--dp-diff-hunk-text)',
                      border: '1px solid var(--dp-border-subtle)',
                    }}
                    onClick={() =>
                      onCompare(
                        ver.snapshotSha,
                        latest.snapshotSha,
                        `D${position} v${ver.version}`,
                        `D${position} v${latest.version}`
                      )
                    }
                  >
                    v{ver.version}{'\u2194'}v{latest.version}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
