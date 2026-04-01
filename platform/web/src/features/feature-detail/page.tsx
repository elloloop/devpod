"use client";

import { use } from 'react';
import Link from 'next/link';
import { useFeaturesDiffs } from '@/packages/git-client';
import { SnapshotTimeline } from './components/snapshot-timeline';
import { mockSnapshotTimeline } from '@/lib/mock-data';

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

const ciIcon: Record<string, { icon: string; color: string }> = {
  passed: { icon: '\u2713', color: 'var(--dp-accent-success)' },
  failed: { icon: '\u2717', color: 'var(--dp-accent-error)' },
  pending: { icon: '\u25D1', color: 'var(--dp-accent-warning)' },
};

interface FeatureDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default function FeatureDetailPage({ params }: FeatureDetailPageProps) {
  const { slug } = use(params);
  const { data: features, isLoading } = useFeaturesDiffs();

  const feature = features?.find((f) => f.feature.slug === slug);

  if (isLoading) {
    return (
      <div className="p-3">
        <div className="space-y-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-6 rounded animate-pulse" style={{ backgroundColor: 'var(--dp-bg-secondary)' }} />
          ))}
        </div>
      </div>
    );
  }

  if (!feature) {
    return (
      <div className="p-3">
        <p style={{ fontSize: 'var(--dp-font-sm)', color: 'var(--dp-text-tertiary)', marginBottom: '8px' }}>
          Feature not found.
        </p>
        <Link
          href="/diffs"
          className="inline-flex items-center gap-1"
          style={{ fontSize: 'var(--dp-font-sm)', color: 'var(--dp-text-tertiary)' }}
        >
          {'\u2190'} Back to Diffs
        </Link>
      </div>
    );
  }

  const { diffs } = feature;
  const snapshots = mockSnapshotTimeline[slug] || [];

  return (
    <div className="p-3">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 mb-2" style={{ fontSize: 'var(--dp-font-sm)', fontFamily: 'var(--dp-font-mono)' }}>
        <Link
          href="/diffs"
          className="hover:underline"
          style={{ color: 'var(--dp-text-tertiary)' }}
        >
          {'\u2190'} Diffs
        </Link>
        <span style={{ color: 'var(--dp-text-tertiary)' }}>/</span>
        <span style={{ fontWeight: 600, color: 'var(--dp-text-primary)' }}>{feature.feature.name}</span>
        <span style={{ color: 'var(--dp-text-tertiary)' }}>{'\u00B7'} {feature.feature.type}</span>
        <span style={{ color: 'var(--dp-text-tertiary)' }}>{'\u00B7'} {diffs.length} {diffs.length === 1 ? 'diff' : 'diffs'}</span>
        <span style={{ color: 'var(--dp-text-tertiary)' }}>{'\u00B7'}</span>
        <code style={{ fontSize: 'var(--dp-font-xs)', color: 'var(--dp-text-tertiary)' }}>{feature.feature.branch}</code>
        {feature.isCurrent && (
          <span
            className="ml-0.5 px-1 rounded"
            style={{ fontSize: '10px', color: 'var(--dp-accent-primary)', backgroundColor: 'rgba(99, 102, 241, 0.12)' }}
          >
            current
          </span>
        )}
      </div>

      {/* Snapshot Timeline */}
      {snapshots.length > 0 && (
        <SnapshotTimeline snapshots={snapshots} />
      )}

      {/* Diff table */}
      <table className="w-full" style={{ fontFamily: 'var(--dp-font-mono)', fontSize: 'var(--dp-font-sm)', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--dp-border-default)', color: 'var(--dp-text-tertiary)' }}>
            <th className="py-1 px-2 text-left font-medium w-10" style={{ fontSize: 'var(--dp-font-xs)' }}>#</th>
            <th className="py-1 px-2 text-left font-medium" style={{ fontSize: 'var(--dp-font-xs)' }}>TITLE</th>
            <th className="py-1 px-2 text-right font-medium w-24" style={{ fontSize: 'var(--dp-font-xs)' }}>+/-</th>
            <th className="py-1 px-2 text-center font-medium w-14" style={{ fontSize: 'var(--dp-font-xs)' }}>CI</th>
            <th className="py-1 px-2 text-right font-medium w-24" style={{ fontSize: 'var(--dp-font-xs)' }}>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {diffs.map((diff) => {
            const ci = diff.ci ? ciIcon[diff.ci] : null;

            return (
              <tr
                key={diff.uuid}
                style={{ borderBottom: '1px solid var(--dp-border-subtle)' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--dp-bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <td className="py-1 px-2 font-bold" style={{ color: 'var(--dp-text-tertiary)' }}>
                  <Link href={`/diffs/${slug}/${diff.position}`} className="hover:underline" prefetch={true}>
                    D{diff.position}
                  </Link>
                </td>
                <td className="py-1 px-2">
                  <Link href={`/diffs/${slug}/${diff.position}`} className="font-medium hover:underline" style={{ color: 'var(--dp-text-primary)' }} prefetch={true}>
                    {diff.title}
                  </Link>
                  {diff.version > 1 && (
                    <span className="ml-1" style={{ fontSize: '10px', color: 'var(--dp-text-tertiary)' }}>
                      v{diff.version}
                    </span>
                  )}
                </td>
                <td className="py-1 px-2 text-right">
                  <span style={{ color: 'var(--dp-accent-success)' }}>+{diff.additions}</span>
                  {diff.deletions > 0 && (
                    <span style={{ color: 'var(--dp-accent-error)' }}>/-{diff.deletions}</span>
                  )}
                  <span className="ml-0.5" style={{ color: 'var(--dp-text-tertiary)' }}>
                    {diff.files.length}f
                  </span>
                </td>
                <td className="py-1 px-2 text-center">
                  {ci ? (
                    <span style={{ color: ci.color }}>{ci.icon}</span>
                  ) : (
                    <span style={{ color: 'var(--dp-text-tertiary)' }}>{'\u2013'}</span>
                  )}
                </td>
                <td className="py-1 px-2 text-right">
                  <span style={{ color: statusColor[diff.status] }}>
                    {statusIcon[diff.status]} {diff.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
