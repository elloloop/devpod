"use client";

import { use } from 'react';
import Link from 'next/link';
import { usePullRequest } from '@/packages/git-client';
import { DiffTable } from '@/packages/ui/patterns/diff-table';

interface PRDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function PRDetailPage({ params }: PRDetailPageProps) {
  const { id } = use(params);
  const { data: pr, isLoading, error } = usePullRequest(id);

  if (isLoading) {
    return (
      <div className="p-3">
        <div className="space-y-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-6 rounded animate-pulse" style={{ backgroundColor: 'var(--dp-bg-secondary)' }} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !pr) {
    return (
      <div className="p-3">
        <p style={{ fontSize: 'var(--dp-font-sm)', color: 'var(--dp-text-tertiary)', marginBottom: '8px' }}>
          {error ? 'Failed to load commit.' : 'Commit not found.'}
        </p>
        <Link href="/prs" style={{ fontSize: 'var(--dp-font-sm)', color: 'var(--dp-text-tertiary)' }}>
          {'\u2190'} Back
        </Link>
      </div>
    );
  }

  return (
    <div className="p-3">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 mb-2" style={{ fontSize: 'var(--dp-font-sm)' }}>
        <Link href="/prs" className="hover:underline" style={{ color: 'var(--dp-text-tertiary)' }}>
          {'\u2190'} Commits
        </Link>
        <span style={{ color: 'var(--dp-text-tertiary)' }}>/</span>
        <span style={{ fontFamily: 'var(--dp-font-mono)', color: 'var(--dp-text-tertiary)' }}>{pr.shortSha}</span>
      </div>

      {/* Header */}
      <h1 style={{ fontSize: 'var(--dp-font-xl)', fontWeight: 600, marginBottom: '4px' }}>{pr.title}</h1>
      <div className="flex items-center gap-2 mb-3" style={{ fontSize: 'var(--dp-font-xs)', fontFamily: 'var(--dp-font-mono)', color: 'var(--dp-text-tertiary)' }}>
        <span>{pr.author}</span>
        <span>{'\u00B7'}</span>
        <span>{pr.shortSha}</span>
        <span>{'\u00B7'}</span>
        <span style={{ color: 'var(--dp-accent-success)' }}>+{pr.totalAdditions}</span>
        <span style={{ color: 'var(--dp-accent-error)' }}>-{pr.totalDeletions}</span>
        <span>{'\u00B7'}</span>
        <span>{pr.files.length} files</span>
      </div>

      {pr.body && (
        <p style={{ fontSize: 'var(--dp-font-sm)', color: 'var(--dp-text-secondary)', maxWidth: '640px', lineHeight: '1.4', marginBottom: '12px' }}>
          {pr.body}
        </p>
      )}

      {/* Diff viewer */}
      <div style={{ borderTop: '1px solid var(--dp-border-subtle)' }}>
        <DiffTable files={pr.files} reviewKey={pr.sha} />
      </div>
    </div>
  );
}
