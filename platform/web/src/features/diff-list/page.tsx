"use client";

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useFeaturesDiffs } from '@/packages/git-client';

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

export default function DiffListPage() {
  const [search, setSearch] = useState('');
  const { data: features, isLoading, error } = useFeaturesDiffs();

  const filtered = useMemo(() => {
    let result = features ?? [];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (f) =>
          f.feature.name.toLowerCase().includes(q) ||
          f.feature.branch.toLowerCase().includes(q) ||
          f.diffs.some((d) => d.title.toLowerCase().includes(q))
      );
    }

    result = [...result].sort((a, b) => {
      if (a.isCurrent && !b.isCurrent) return -1;
      if (!a.isCurrent && b.isCurrent) return 1;
      const aLatest = a.diffs.length ? Math.max(...a.diffs.map((d) => new Date(d.updated).getTime())) : 0;
      const bLatest = b.diffs.length ? Math.max(...b.diffs.map((d) => new Date(d.updated).getTime())) : 0;
      return bLatest - aLatest;
    });

    return result;
  }, [features, search]);

  const totalDiffs = (features ?? []).reduce((sum, f) => sum + f.diffs.length, 0);

  // Keyboard: / to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '/') {
        e.preventDefault();
        document.getElementById('diff-search')?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h1 style={{ fontSize: 'var(--dp-font-lg)', fontWeight: 600 }}>Stacked Diffs</h1>
          <span style={{ fontSize: 'var(--dp-font-xs)', color: 'var(--dp-text-tertiary)', fontFamily: 'var(--dp-font-mono)' }}>
            {features?.length ?? 0} features {'\u00B7'} {totalDiffs} diffs
          </span>
        </div>

        <div className="relative">
          <input
            id="diff-search"
            type="text"
            placeholder="Search... (/)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded outline-none"
            style={{
              fontFamily: 'var(--dp-font-mono)',
              fontSize: 'var(--dp-font-sm)',
              padding: '2px 8px',
              height: '24px',
              width: '200px',
              backgroundColor: 'var(--dp-bg-secondary)',
              border: '1px solid var(--dp-border-default)',
              color: 'var(--dp-text-primary)',
            }}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-6 rounded animate-pulse" style={{ backgroundColor: 'var(--dp-bg-secondary)' }} />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-6" style={{ fontSize: 'var(--dp-font-sm)', color: 'var(--dp-accent-error)' }}>
          Failed to load diffs.
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-6" style={{ fontSize: 'var(--dp-font-sm)', color: 'var(--dp-text-tertiary)' }}>
          No features found.
        </div>
      ) : (
        <table
          className="w-full"
          style={{ fontFamily: 'var(--dp-font-mono)', fontSize: 'var(--dp-font-sm)', borderCollapse: 'collapse' }}
        >
          <thead>
            <tr style={{ borderBottom: '1px solid var(--dp-border-default)', color: 'var(--dp-text-tertiary)' }}>
              <th className="py-1 px-2 text-left font-medium" style={{ fontSize: 'var(--dp-font-xs)' }}>FEATURE</th>
              <th className="py-1 px-2 text-left font-medium w-14" style={{ fontSize: 'var(--dp-font-xs)' }}>TYPE</th>
              <th className="py-1 px-2 text-left font-medium" style={{ fontSize: 'var(--dp-font-xs)' }}>LATEST</th>
              <th className="py-1 px-2 text-right font-medium" style={{ fontSize: 'var(--dp-font-xs)' }}>STACK</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((feature) => {
              const { diffs } = feature;
              const latest = diffs.length > 0 ? diffs[diffs.length - 1] : null;

              return (
                <tr
                  key={feature.feature.slug}
                  className="group"
                  style={{ borderBottom: '1px solid var(--dp-border-subtle)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--dp-bg-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <td className="py-1 px-2">
                    <Link
                      href={`/diffs/${feature.feature.slug}`}
                      className="font-medium hover:underline"
                      style={{ color: 'var(--dp-text-primary)' }}
                      prefetch={true}
                    >
                      {feature.feature.name}
                    </Link>
                    {feature.isCurrent && (
                      <span
                        className="ml-1 px-1 rounded"
                        style={{ fontSize: '10px', color: 'var(--dp-accent-primary)', backgroundColor: 'rgba(99, 102, 241, 0.12)' }}
                      >
                        current
                      </span>
                    )}
                  </td>
                  <td className="py-1 px-2" style={{ color: 'var(--dp-text-tertiary)' }}>
                    {feature.feature.type}
                  </td>
                  <td className="py-1 px-2 truncate max-w-[300px]" style={{ color: 'var(--dp-text-secondary)' }}>
                    {latest ? latest.title : '\u2014'}
                  </td>
                  <td className="py-1 px-2 text-right">
                    <span className="inline-flex items-center gap-0.5">
                      {diffs.map((d) => (
                        <Link
                          key={d.uuid}
                          href={`/diffs/${feature.feature.slug}/${d.position}`}
                          className="hover:underline"
                          prefetch={true}
                        >
                          <span style={{ color: statusColor[d.status] }}>
                            D{d.position}{statusIcon[d.status]}
                          </span>
                        </Link>
                      ))}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
