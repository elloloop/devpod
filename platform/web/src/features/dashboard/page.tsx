"use client";

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  mockFeatures,
  mockPullRequests,
  mockWorkflowRuns,
  mockActivity,
} from '@/lib/mock-data';
import type { Feature, PullRequest, WorkflowRun, ActivityItem } from '@/packages/git-client';

async function fetchDashboardData() {
  const [features, prs, runs, activity] = await Promise.all([
    fetch('/api/features').then((r) => (r.ok ? r.json() : mockFeatures)).catch(() => mockFeatures) as Promise<Feature[]>,
    fetch('/api/prs').then((r) => (r.ok ? r.json() : mockPullRequests)).catch(() => mockPullRequests) as Promise<PullRequest[]>,
    Promise.resolve(mockWorkflowRuns) as Promise<WorkflowRun[]>,
    Promise.resolve(mockActivity) as Promise<ActivityItem[]>,
  ]);
  return { features, prs, runs, activity };
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardData,
  });

  if (isLoading || !data) {
    return (
      <div className="p-3">
        <h1 style={{ fontSize: 'var(--dp-font-xl)', fontWeight: 600, marginBottom: '12px' }}>Dashboard</h1>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 rounded animate-pulse" style={{ backgroundColor: 'var(--dp-bg-secondary)' }} />
          ))}
        </div>
      </div>
    );
  }

  const openPRs = data.prs.filter((p) => p.status === 'open').length;
  const runningRuns = data.runs.filter((r) => r.status === 'in_progress').length;
  const failedRuns = data.runs.filter((r) => r.conclusion === 'failure').length;

  return (
    <div className="p-3">
      <h1 style={{ fontSize: 'var(--dp-font-xl)', fontWeight: 600, marginBottom: '12px' }}>Dashboard</h1>

      {/* Stats */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <StatCard label="Features" value={data.features.length} href="/features" />
        <StatCard label="Open PRs" value={openPRs} href="/prs" />
        <StatCard label="Running" value={runningRuns} href="/runs" accent={runningRuns > 0 ? 'var(--dp-accent-info)' : undefined} />
        <StatCard label="Failed" value={failedRuns} href="/runs" accent={failedRuns > 0 ? 'var(--dp-accent-error)' : undefined} />
      </div>

      {/* Activity */}
      <div style={{ borderTop: '1px solid var(--dp-border-subtle)', paddingTop: '8px' }}>
        <h2 style={{ fontSize: 'var(--dp-font-base)', fontWeight: 600, marginBottom: '6px' }}>Recent Activity</h2>
        <div className="space-y-0.5">
          {data.activity.slice(0, 8).map((item) => (
            <Link
              key={item.id}
              href={item.link}
              className="flex items-center gap-2 px-2 rounded hover:bg-[var(--dp-bg-hover)] transition-colors"
              style={{ lineHeight: 'var(--dp-lh-compact)', fontSize: 'var(--dp-font-sm)' }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: getStatusColor(item.status), flexShrink: 0 }} />
              <span style={{ color: 'var(--dp-text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.title}
              </span>
              <span style={{ color: 'var(--dp-text-tertiary)', fontFamily: 'var(--dp-font-mono)', fontSize: 'var(--dp-font-xs)', flexShrink: 0 }}>
                {item.type}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div className="mt-4 flex gap-2" style={{ fontSize: 'var(--dp-font-sm)' }}>
        <Link href="/diffs" className="px-2 py-1 rounded" style={{ backgroundColor: 'var(--dp-bg-secondary)', border: '1px solid var(--dp-border-subtle)', color: 'var(--dp-text-primary)' }}>
          Stacked Diffs
        </Link>
        <Link href="/features" className="px-2 py-1 rounded" style={{ backgroundColor: 'var(--dp-bg-secondary)', border: '1px solid var(--dp-border-subtle)', color: 'var(--dp-text-primary)' }}>
          Features
        </Link>
        <Link href="/runs" className="px-2 py-1 rounded" style={{ backgroundColor: 'var(--dp-bg-secondary)', border: '1px solid var(--dp-border-subtle)', color: 'var(--dp-text-primary)' }}>
          Runs
        </Link>
      </div>
    </div>
  );
}

function StatCard({ label, value, href, accent }: { label: string; value: number; href: string; accent?: string }) {
  return (
    <Link
      href={href}
      className="rounded px-3 py-2 hover:bg-[var(--dp-bg-hover)] transition-colors"
      style={{
        backgroundColor: 'var(--dp-bg-secondary)',
        border: '1px solid var(--dp-border-subtle)',
      }}
    >
      <div style={{ fontSize: 'var(--dp-font-xs)', color: 'var(--dp-text-tertiary)' }}>{label}</div>
      <div style={{ fontSize: 'var(--dp-font-xl)', fontWeight: 600, color: accent || 'var(--dp-text-primary)', fontFamily: 'var(--dp-font-mono)' }}>
        {value}
      </div>
    </Link>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed': case 'merged': case 'shipped': case 'success': return 'var(--dp-accent-success)';
    case 'open': case 'review': case 'in_progress': return 'var(--dp-accent-info)';
    case 'failed': case 'failure': return 'var(--dp-accent-error)';
    default: return 'var(--dp-text-tertiary)';
  }
}
