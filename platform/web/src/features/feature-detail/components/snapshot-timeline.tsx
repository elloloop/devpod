"use client";

import { useState } from 'react';
import type { DiffVersionInfo } from '@/packages/git-client';

interface SnapshotTimelineProps {
  snapshots: DiffVersionInfo[];
}

function shortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function shortTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function SnapshotTimeline({ snapshots }: SnapshotTimelineProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (snapshots.length === 0) return null;

  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div
      style={{
        borderBottom: '1px solid var(--dp-border-subtle)',
        padding: '8px 8px 12px 8px',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--dp-font-mono)',
          fontSize: 'var(--dp-font-xs)',
          color: 'var(--dp-text-tertiary)',
          marginBottom: '8px',
        }}
      >
        Snapshot Timeline
      </div>

      {/* Timeline track */}
      <div
        className="relative flex items-center"
        style={{
          height: '40px',
          paddingLeft: '12px',
          paddingRight: '12px',
        }}
      >
        {/* Line */}
        <div
          className="absolute"
          style={{
            left: '12px',
            right: '12px',
            top: '50%',
            height: '1px',
            backgroundColor: 'var(--dp-border-default)',
            transform: 'translateY(-50%)',
          }}
        />

        {/* Dots */}
        <div className="relative flex items-center justify-between w-full">
          {sorted.map((snap, idx) => {
            const isUpdate = snap.action === 'update';
            const isUndo = snap.action === 'undo';
            const dotColor = isUpdate
              ? 'var(--dp-accent-info)'
              : isUndo
                ? 'var(--dp-accent-warning)'
                : 'var(--dp-accent-success)';

            return (
              <div
                key={snap.snapshotId}
                className="relative flex flex-col items-center"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: 'default' }}
              >
                {/* Dot */}
                <div
                  style={{
                    width: isUpdate || isUndo ? '8px' : '6px',
                    height: isUpdate || isUndo ? '8px' : '6px',
                    borderRadius: '50%',
                    backgroundColor: dotColor,
                    border: `1px solid ${dotColor}`,
                    boxShadow: hoveredIdx === idx ? `0 0 6px ${dotColor}` : 'none',
                    transition: 'box-shadow 0.15s',
                  }}
                />

                {/* Label below */}
                <div
                  className="absolute text-center"
                  style={{
                    top: '14px',
                    whiteSpace: 'nowrap',
                    fontFamily: 'var(--dp-font-mono)',
                    fontSize: '10px',
                    color: 'var(--dp-text-tertiary)',
                  }}
                >
                  {snap.snapshotId}
                </div>

                {/* Hover tooltip */}
                {hoveredIdx === idx && (
                  <div
                    className="absolute z-50 rounded px-2 py-1"
                    style={{
                      bottom: '18px',
                      whiteSpace: 'nowrap',
                      fontFamily: 'var(--dp-font-mono)',
                      fontSize: '10px',
                      backgroundColor: 'var(--dp-bg-tertiary)',
                      border: '1px solid var(--dp-border-default)',
                      color: 'var(--dp-text-primary)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>
                      {snap.snapshotId} {'\u00B7'} {shortDate(snap.date)} {shortTime(snap.date)}
                    </div>
                    <div style={{ color: 'var(--dp-text-secondary)' }}>{snap.message}</div>
                    <div style={{ color: 'var(--dp-text-tertiary)' }}>
                      stack: {snap.stack}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
