"use client";

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useWorkflowRuns } from '@/packages/git-client';

const statusFilters = ['all', 'completed', 'in_progress', 'queued', 'failed'] as const;
type StatusFilter = (typeof statusFilters)[number];

const statusLabels: Record<string, string> = {
  all: 'All',
  completed: 'Passed',
  in_progress: 'Running',
  queued: 'Queued',
  failed: 'Failed',
};

function getRunColor(run: { status: string; conclusion?: string }): string {
  if (run.conclusion === 'failure') return 'var(--dp-accent-error)';
  if (run.conclusion === 'success') return 'var(--dp-accent-success)';
  if (run.status === 'in_progress') return 'var(--dp-accent-info)';
  if (run.status === 'queued') return 'var(--dp-accent-warning)';
  return 'var(--dp-text-tertiary)';
}

export default function RunsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { data: runs, isLoading } = useWorkflowRuns();

  const filtered = useMemo(() => {
    let result = runs ?? [];

    if (statusFilter !== 'all') {
      if (statusFilter === 'failed') {
        result = result.filter((r) => r.status === 'completed' && r.conclusion === 'failure');
      } else {
        result = result.filter((r) => r.status === statusFilter);
      }
    }

    return [...result].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [runs, statusFilter]);

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <h1 style={{ fontSize: 'var(--dp-font-lg)', fontWeight: 600 }}>Workflow Runs</h1>
      </div>

      <div className="flex gap-1 mb-2">
        {statusFilters.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className="px-1.5 py-px rounded"
            style={{
              fontFamily: 'var(--dp-font-sans)',
              fontSize: 'var(--dp-font-xs)',
              backgroundColor: statusFilter === s ? 'var(--dp-accent-primary)' : 'var(--dp-bg-secondary)',
              color: statusFilter === s ? '#fff' : 'var(--dp-text-secondary)',
              border: `1px solid ${statusFilter === s ? 'var(--dp-accent-primary)' : 'var(--dp-border-default)'}`,
            }}
          >
            {statusLabels[s]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-6 rounded animate-pulse" style={{ backgroundColor: 'var(--dp-bg-secondary)' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8" style={{ fontSize: 'var(--dp-font-sm)', color: 'var(--dp-text-tertiary)' }}>
          No runs found.
        </div>
      ) : (
        <table className="w-full" style={{ fontFamily: 'var(--dp-font-mono)', fontSize: 'var(--dp-font-sm)', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--dp-border-default)', color: 'var(--dp-text-tertiary)' }}>
              <th className="py-1 px-2 text-left font-medium" style={{ fontSize: 'var(--dp-font-xs)' }}>WORKFLOW</th>
              <th className="py-1 px-2 text-left font-medium" style={{ fontSize: 'var(--dp-font-xs)' }}>BRANCH</th>
              <th className="py-1 px-2 text-center font-medium w-20" style={{ fontSize: 'var(--dp-font-xs)' }}>STATUS</th>
              <th className="py-1 px-2 text-right font-medium w-16" style={{ fontSize: 'var(--dp-font-xs)' }}>JOBS</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((run) => (
              <tr
                key={run.id}
                style={{ borderBottom: '1px solid var(--dp-border-subtle)' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--dp-bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <td className="py-1 px-2">
                  <Link href={`/runs/${run.id}`} className="hover:underline" style={{ color: 'var(--dp-text-primary)' }}>
                    {run.workflow}
                  </Link>
                </td>
                <td className="py-1 px-2" style={{ color: 'var(--dp-text-tertiary)' }}>
                  {run.trigger.ref.replace('refs/heads/', '')}
                </td>
                <td className="py-1 px-2 text-center">
                  <span style={{ color: getRunColor(run) }}>
                    {run.conclusion || run.status}
                  </span>
                </td>
                <td className="py-1 px-2 text-right" style={{ color: 'var(--dp-text-tertiary)' }}>
                  {run.jobs.length}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
