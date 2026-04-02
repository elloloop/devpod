"use client";

import Link from 'next/link';
import { useReviewActions } from '@/packages/review';
import type { DiffDetail, StackedDiff } from '@/packages/git-client';
import type { DiffFile } from '@/packages/diff-engine';

interface DiffHeaderProps {
  diff: DiffDetail;
  featureSlug: string;
  featureName: string;
  siblingDiffs: StackedDiff[];
  compareSelector?: React.ReactNode;
}

const statusIcon: Record<string, string> = {
  draft: '\u25CB',
  submitted: '\u25D1',
  approved: '\u2713',
  landed: '\u25CF',
};

const statusColor: Record<string, string> = {
  draft: 'var(--dp-text-tertiary)',
  submitted: 'var(--dp-accent-info)',
  approved: 'var(--dp-accent-success)',
  landed: '#a78bfa',
};

const ciLabel: Record<string, { icon: string; color: string }> = {
  passed: { icon: '\u2713', color: 'var(--dp-accent-success)' },
  failed: { icon: '\u2717', color: 'var(--dp-accent-error)' },
  pending: { icon: '\u25D1', color: 'var(--dp-accent-warning)' },
};

export function DiffHeader({ diff, featureSlug, featureName, siblingDiffs, compareSelector }: DiffHeaderProps) {
  const { loading, feedback, handleApprove, handleReject } = useReviewActions(featureSlug, diff.position);

  const files: DiffFile[] = diff.detailedFiles ?? diff.files;

  return (
    <>
      {/* Main header — 36px */}
      <div
        className="sticky top-0 z-30 flex items-center gap-1.5 px-2 shrink-0"
        style={{
          height: '36px',
          minHeight: '36px',
          backgroundColor: 'var(--dp-bg-secondary)',
          borderBottom: '1px solid var(--dp-border-subtle)',
          color: 'var(--dp-text-primary)',
          fontFamily: 'var(--dp-font-mono)',
          fontSize: 'var(--dp-font-sm)',
        }}
      >
        <Link
          href={`/diffs/${featureSlug}`}
          className="flex items-center gap-1 shrink-0 hover:underline"
          style={{ color: 'var(--dp-text-tertiary)' }}
          prefetch={true}
        >
          <span style={{ fontSize: '10px' }}>{'\u2190'}</span>
          <span>{featureName}</span>
        </Link>

        <Dot />
        <span className="font-bold">D{diff.position}</span>
        <Dot />
        <span className="truncate min-w-0 flex-1" style={{ color: 'var(--dp-text-primary)' }}>
          {diff.title}
        </span>

        <span className="shrink-0 flex items-center gap-1">
          <span style={{ color: 'var(--dp-accent-success)' }}>+{diff.additions}</span>
          <span style={{ color: 'var(--dp-accent-error)' }}>-{diff.deletions}</span>
          <Dot />
          <span style={{ color: 'var(--dp-text-tertiary)' }}>{files.length}f</span>
          <Dot />
          <span style={{ color: statusColor[diff.status] }}>
            {statusIcon[diff.status]} {diff.status}
          </span>

          {diff.ci && ciLabel[diff.ci] && (
            <>
              <Dot />
              <span style={{ color: ciLabel[diff.ci].color }}>
                {ciLabel[diff.ci].icon} CI
              </span>
            </>
          )}

          <Dot />

          {compareSelector}

          <Dot />

          <button
            onClick={handleApprove}
            disabled={loading !== null || diff.status === 'landed'}
            className="px-1.5 py-px rounded transition-colors disabled:opacity-40"
            style={{
              fontFamily: 'var(--dp-font-sans)',
              fontSize: 'var(--dp-font-xs)',
              fontWeight: 500,
              backgroundColor: 'rgba(34, 197, 94, 0.12)',
              color: 'var(--dp-accent-success)',
              border: '1px solid rgba(34, 197, 94, 0.25)',
            }}
          >
            {loading === 'approve' ? '...' : 'Approve'}
          </button>
          <button
            onClick={() => handleReject()}
            disabled={loading !== null || diff.status === 'landed'}
            className="px-1.5 py-px rounded transition-colors disabled:opacity-40"
            style={{
              fontFamily: 'var(--dp-font-sans)',
              fontSize: 'var(--dp-font-xs)',
              fontWeight: 500,
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              color: 'var(--dp-accent-error)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
            }}
          >
            {loading === 'reject' ? '...' : 'Changes'}
          </button>

          {feedback && (
            <span style={{ color: 'var(--dp-accent-success)', fontSize: 'var(--dp-font-xs)', fontFamily: 'var(--dp-font-sans)' }}>
              {feedback}
            </span>
          )}
        </span>
      </div>

      {/* Stack nav — 24px */}
      {siblingDiffs.length > 1 && (
        <div
          className="flex items-center gap-0.5 px-2 shrink-0"
          style={{
            height: '24px',
            minHeight: '24px',
            backgroundColor: 'var(--dp-diff-gutter-bg)',
            borderBottom: '1px solid var(--dp-border-subtle)',
            fontFamily: 'var(--dp-font-mono)',
            fontSize: 'var(--dp-font-xs)',
            color: 'var(--dp-text-tertiary)',
          }}
        >
          {siblingDiffs.map((d, i) => {
            const isCurrent = d.uuid === diff.uuid;
            return (
              <span key={d.uuid} className="flex items-center">
                {i > 0 && <span className="mx-0.5 opacity-40">{'\u2192'}</span>}
                <Link
                  href={`/diffs/${featureSlug}/${d.position}`}
                  className="inline-flex items-center gap-0.5 px-1 rounded transition-colors"
                  style={{
                    backgroundColor: isCurrent ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                    color: isCurrent ? 'var(--dp-accent-primary)' : 'var(--dp-text-tertiary)',
                    border: isCurrent ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
                    lineHeight: '18px',
                  }}
                  prefetch={true}
                >
                  D{d.position}
                  <span style={{ color: statusColor[d.status] }}>{statusIcon[d.status]}</span>
                </Link>
              </span>
            );
          })}
          <span className="ml-auto opacity-50" style={{ fontSize: '10px' }}>
            n/p navigate
          </span>
        </div>
      )}
    </>
  );
}

function Dot() {
  return <span style={{ color: 'var(--dp-text-tertiary)', margin: '0 1px' }}>{'\u00B7'}</span>;
}
