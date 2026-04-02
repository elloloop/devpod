"use client";

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { usePullRequests } from '@/packages/git-client';

export default function PRsPage() {
  const [search, setSearch] = useState('');
  const { data: prs, isLoading, error } = usePullRequests();

  const filtered = useMemo(() => {
    let result = prs ?? [];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (pr) =>
          pr.title.toLowerCase().includes(q) ||
          pr.shortSha.toLowerCase().includes(q) ||
          pr.author.toLowerCase().includes(q)
      );
    }
    return [...result].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [prs, search]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '/') {
        e.preventDefault();
        document.getElementById('pr-search')?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h1 style={{ fontSize: 'var(--dp-font-lg)', fontWeight: 600 }}>Commits</h1>
          <span style={{ fontSize: 'var(--dp-font-xs)', color: 'var(--dp-text-tertiary)', fontFamily: 'var(--dp-font-mono)' }}>
            {prs?.length ?? 0} from main
          </span>
        </div>
        <input
          id="pr-search"
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

      {isLoading ? (
        <div className="space-y-0.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-6 rounded animate-pulse" style={{ backgroundColor: 'var(--dp-bg-secondary)' }} />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-6" style={{ fontSize: 'var(--dp-font-sm)', color: 'var(--dp-accent-error)' }}>
          Failed to load commits.
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-6" style={{ fontSize: 'var(--dp-font-sm)', color: 'var(--dp-text-tertiary)' }}>
          No commits found.
        </div>
      ) : (
        <table className="w-full" style={{ fontFamily: 'var(--dp-font-mono)', fontSize: 'var(--dp-font-sm)', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--dp-border-default)', color: 'var(--dp-text-tertiary)' }}>
              <th className="py-1 px-2 text-left font-medium w-16" style={{ fontSize: 'var(--dp-font-xs)' }}>SHA</th>
              <th className="py-1 px-2 text-left font-medium" style={{ fontSize: 'var(--dp-font-xs)' }}>TITLE</th>
              <th className="py-1 px-2 text-left font-medium w-20" style={{ fontSize: 'var(--dp-font-xs)' }}>AUTHOR</th>
              <th className="py-1 px-2 text-right font-medium w-20" style={{ fontSize: 'var(--dp-font-xs)' }}>+/-</th>
              <th className="py-1 px-2 text-right font-medium w-14" style={{ fontSize: 'var(--dp-font-xs)' }}>FILES</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((pr) => (
              <tr
                key={pr.sha}
                style={{ borderBottom: '1px solid var(--dp-border-subtle)' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--dp-bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <td className="py-1 px-2" style={{ color: 'var(--dp-text-tertiary)' }}>
                  <Link href={`/prs/${pr.shortSha}`} className="hover:underline">
                    {pr.shortSha}
                  </Link>
                </td>
                <td className="py-1 px-2 truncate max-w-[400px]">
                  <Link href={`/prs/${pr.shortSha}`} className="hover:underline" style={{ color: 'var(--dp-text-primary)' }}>
                    {pr.title}
                  </Link>
                </td>
                <td className="py-1 px-2" style={{ color: 'var(--dp-text-tertiary)' }}>
                  {pr.author}
                </td>
                <td className="py-1 px-2 text-right">
                  <span style={{ color: 'var(--dp-accent-success)' }}>+{pr.totalAdditions}</span>
                  <span style={{ color: 'var(--dp-accent-error)' }}>-{pr.totalDeletions}</span>
                </td>
                <td className="py-1 px-2 text-right" style={{ color: 'var(--dp-text-tertiary)' }}>
                  {pr.files.length}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
