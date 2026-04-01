"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useFeatures } from '@/packages/git-client';

const statuses = ['all', 'in-progress', 'review', 'shipped'] as const;
type FilterStatus = (typeof statuses)[number];

const statusColor: Record<string, string> = {
  'in-progress': 'var(--dp-accent-warning)',
  review: 'var(--dp-accent-info)',
  shipped: 'var(--dp-accent-success)',
};

export default function FeaturesPage() {
  const [filter, setFilter] = useState<FilterStatus>('all');
  const { data: features, isLoading } = useFeatures();

  const filtered =
    filter === 'all'
      ? features ?? []
      : (features ?? []).filter((f) => f.status === filter);

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <h1 style={{ fontSize: 'var(--dp-font-lg)', fontWeight: 600 }}>Features</h1>
      </div>

      <div className="flex gap-1 mb-2">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className="px-1.5 py-px rounded capitalize"
            style={{
              fontFamily: 'var(--dp-font-sans)',
              fontSize: 'var(--dp-font-xs)',
              backgroundColor: filter === s ? 'var(--dp-accent-primary)' : 'var(--dp-bg-secondary)',
              color: filter === s ? '#fff' : 'var(--dp-text-secondary)',
              border: `1px solid ${filter === s ? 'var(--dp-accent-primary)' : 'var(--dp-border-default)'}`,
            }}
          >
            {s === 'all' ? 'All' : s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded animate-pulse" style={{ backgroundColor: 'var(--dp-bg-secondary)' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8" style={{ fontSize: 'var(--dp-font-sm)', color: 'var(--dp-text-tertiary)' }}>
          No features found.
        </div>
      ) : (
        <div className="space-y-px">
          {filtered.map((feature) => (
            <Link
              key={feature.slug}
              href={`/features/${feature.slug}`}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--dp-bg-hover)] transition-colors"
              style={{ borderBottom: '1px solid var(--dp-border-subtle)' }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: statusColor[feature.status] || 'var(--dp-text-tertiary)',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 'var(--dp-font-base)', fontWeight: 500, color: 'var(--dp-text-primary)', flex: 1 }}>
                {feature.title}
              </span>
              <span style={{ fontSize: 'var(--dp-font-xs)', color: 'var(--dp-text-tertiary)', fontFamily: 'var(--dp-font-mono)' }}>
                {feature.status}
              </span>
              <span style={{ fontSize: 'var(--dp-font-xs)', color: 'var(--dp-text-tertiary)', fontFamily: 'var(--dp-font-mono)' }}>
                {feature.prs.length} PRs
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
