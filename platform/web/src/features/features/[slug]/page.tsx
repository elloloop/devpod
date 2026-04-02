"use client";

import { use } from 'react';
import Link from 'next/link';
import { useFeature } from '@/packages/git-client';

interface FeatureSlugPageProps {
  params: Promise<{ slug: string }>;
}

const statusColor: Record<string, string> = {
  'in-progress': 'var(--dp-accent-warning)',
  review: 'var(--dp-accent-info)',
  shipped: 'var(--dp-accent-success)',
};

export default function FeatureSlugPage({ params }: FeatureSlugPageProps) {
  const { slug } = use(params);
  const { data: feature, isLoading } = useFeature(slug);

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

  if (!feature) {
    return (
      <div className="p-3">
        <p style={{ fontSize: 'var(--dp-font-sm)', color: 'var(--dp-text-tertiary)', marginBottom: '8px' }}>
          Feature not found.
        </p>
        <Link href="/features" style={{ fontSize: 'var(--dp-font-sm)', color: 'var(--dp-text-tertiary)' }}>
          {'\u2190'} Back
        </Link>
      </div>
    );
  }

  return (
    <div className="p-3">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 mb-3" style={{ fontSize: 'var(--dp-font-sm)' }}>
        <Link href="/features" className="hover:underline" style={{ color: 'var(--dp-text-tertiary)' }}>
          {'\u2190'} Features
        </Link>
        <span style={{ color: 'var(--dp-text-tertiary)' }}>/</span>
        <span style={{ fontWeight: 600, color: 'var(--dp-text-primary)' }}>{feature.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <h1 style={{ fontSize: 'var(--dp-font-xl)', fontWeight: 600 }}>{feature.title}</h1>
        <span
          className="px-1.5 py-px rounded"
          style={{
            fontSize: 'var(--dp-font-xs)',
            fontFamily: 'var(--dp-font-mono)',
            backgroundColor: `${statusColor[feature.status]}22`,
            color: statusColor[feature.status] || 'var(--dp-text-tertiary)',
            border: `1px solid ${statusColor[feature.status]}44`,
          }}
        >
          {feature.status}
        </span>
      </div>

      <p style={{ fontSize: 'var(--dp-font-base)', color: 'var(--dp-text-secondary)', maxWidth: '640px', lineHeight: '1.5', marginBottom: '16px' }}>
        {feature.description}
      </p>

      {/* PRs */}
      <div style={{ borderTop: '1px solid var(--dp-border-subtle)', paddingTop: '8px' }}>
        <h2 style={{ fontSize: 'var(--dp-font-base)', fontWeight: 600, marginBottom: '4px' }}>
          Related PRs ({feature.prs.length})
        </h2>
        <div className="space-y-px">
          {feature.prs.map((pr) => (
            <Link
              key={pr.number}
              href={`/prs/${pr.number}`}
              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[var(--dp-bg-hover)] transition-colors"
            >
              <span style={{ fontFamily: 'var(--dp-font-mono)', fontSize: 'var(--dp-font-sm)', color: 'var(--dp-text-tertiary)' }}>
                #{pr.number}
              </span>
              <span style={{ fontSize: 'var(--dp-font-sm)', color: 'var(--dp-text-primary)', flex: 1 }}>
                {pr.title}
              </span>
              <span
                className="px-1 rounded"
                style={{
                  fontSize: '10px',
                  fontFamily: 'var(--dp-font-mono)',
                  color: pr.status === 'merged' ? 'var(--dp-accent-success)' : 'var(--dp-accent-info)',
                }}
              >
                {pr.status}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
