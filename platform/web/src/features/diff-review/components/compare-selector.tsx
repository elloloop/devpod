"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDiffVersions, useCompare } from '@/packages/git-client';
import type { DiffVersionInfo, CompareResult } from '@/packages/git-client';
import type { StackedDiff } from '@/packages/git-client';

export interface CompareMode {
  type: 'default' | 'interdiff' | 'cumulative';
  label: string;
  left?: string;
  right?: string;
  leftLabel?: string;
  rightLabel?: string;
}

interface CompareSelectorProps {
  slug: string;
  position: number;
  siblingDiffs: StackedDiff[];
  currentVersion: number;
  activeCompare: CompareMode;
  onCompareChange: (mode: CompareMode) => void;
}

export function CompareSelector({
  slug,
  position,
  siblingDiffs,
  currentVersion,
  activeCompare,
  onCompareChange,
}: CompareSelectorProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { data: versions } = useDiffVersions(slug, position);

  // Keyboard: c to toggle compare mode
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'c') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    },
    []
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const sorted = versions ? [...versions].sort((a, b) => a.version - b.version) : [];

  // Build compare options
  const options: CompareMode[] = [
    { type: 'default', label: 'Current diff (default)' },
  ];

  // Interdiff options between consecutive versions
  for (let i = 0; i < sorted.length - 1; i++) {
    const from = sorted[i];
    const to = sorted[i + 1];
    options.push({
      type: 'interdiff',
      label: `D${position} v${from.version} \u2192 v${to.version} (interdiff)`,
      left: from.snapshotSha,
      right: to.snapshotSha,
      leftLabel: `D${position} v${from.version}`,
      rightLabel: `D${position} v${to.version}`,
    });
  }

  // Full change from v1 to latest
  if (sorted.length >= 2) {
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (last.version - first.version > 1) {
      options.push({
        type: 'interdiff',
        label: `D${position} v${first.version} \u2192 v${last.version} (full change)`,
        left: first.snapshotSha,
        right: last.snapshotSha,
        leftLabel: `D${position} v${first.version}`,
        rightLabel: `D${position} v${last.version}`,
      });
    }
  }

  // Diff-to-diff: compare with adjacent diffs in the stack
  const prevDiff = siblingDiffs.find((d) => d.position === position - 1);
  const nextDiff = siblingDiffs.find((d) => d.position === position + 1);
  if (prevDiff && prevDiff.commit && prevDiff.commit.length >= 6) {
    options.push({
      type: 'cumulative',
      label: `D${position} vs D${prevDiff.position} (diff to diff)`,
      left: prevDiff.commit,
      right: siblingDiffs.find((d) => d.position === position)?.commit || '',
      leftLabel: `D${prevDiff.position}`,
      rightLabel: `D${position}`,
    });
  }

  if (options.length <= 1) return null;

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-1.5 py-px rounded transition-colors"
        style={{
          fontFamily: 'var(--dp-font-mono)',
          fontSize: 'var(--dp-font-xs)',
          color: activeCompare.type === 'default' ? 'var(--dp-text-tertiary)' : 'var(--dp-accent-primary)',
          border: `1px solid ${activeCompare.type === 'default' ? 'var(--dp-border-default)' : 'rgba(99, 102, 241, 0.3)'}`,
          backgroundColor: activeCompare.type === 'default' ? 'transparent' : 'rgba(99, 102, 241, 0.08)',
        }}
      >
        <span style={{ fontSize: '10px' }}>{'\u2194'}</span>
        <span>{activeCompare.type === 'default' ? 'Compare' : activeCompare.label}</span>
        <span style={{ fontSize: '10px', marginLeft: '2px', opacity: 0.5 }}>c</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-0.5 z-50 rounded overflow-hidden"
          style={{
            minWidth: '320px',
            backgroundColor: 'var(--dp-bg-secondary)',
            border: '1px solid var(--dp-border-default)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          }}
        >
          <div
            className="px-2 py-1"
            style={{
              borderBottom: '1px solid var(--dp-border-subtle)',
              fontFamily: 'var(--dp-font-sans)',
              fontSize: 'var(--dp-font-xs)',
              color: 'var(--dp-text-tertiary)',
              fontWeight: 500,
            }}
          >
            Compare
          </div>
          {options.map((opt, idx) => {
            const isActive =
              activeCompare.type === opt.type &&
              activeCompare.left === opt.left &&
              activeCompare.right === opt.right;

            return (
              <button
                key={idx}
                className="flex items-center gap-1.5 w-full px-2 text-left transition-colors"
                style={{
                  lineHeight: 'var(--dp-lh-compact)',
                  fontFamily: 'var(--dp-font-mono)',
                  fontSize: 'var(--dp-font-xs)',
                  color: isActive ? 'var(--dp-accent-primary)' : 'var(--dp-text-secondary)',
                  backgroundColor: isActive ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'var(--dp-bg-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                }}
                onClick={() => {
                  onCompareChange(opt);
                  setOpen(false);
                }}
              >
                <span
                  style={{
                    width: '10px',
                    fontSize: '10px',
                    color: isActive ? 'var(--dp-accent-primary)' : 'transparent',
                  }}
                >
                  {'\u25CF'}
                </span>
                <span className="truncate">{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
