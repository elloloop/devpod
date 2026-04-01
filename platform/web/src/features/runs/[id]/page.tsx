"use client";

import { use, useState } from 'react';
import Link from 'next/link';
import { useWorkflowRun, useRunArtifacts } from '@/packages/git-client';
import { differenceInSeconds, parseISO } from 'date-fns';

interface RunDetailPageProps {
  params: Promise<{ id: string }>;
}

function formatDuration(start: string, end: string): string {
  const seconds = differenceInSeconds(parseISO(end), parseISO(start));
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getStepColor(step: { conclusion?: string; status: string }): string {
  if (step.conclusion === 'success') return 'var(--dp-accent-success)';
  if (step.conclusion === 'failure') return 'var(--dp-accent-error)';
  if (step.status === 'in_progress') return 'var(--dp-accent-info)';
  if (step.conclusion === 'skipped') return 'var(--dp-text-tertiary)';
  return 'var(--dp-text-tertiary)';
}

function getStepIcon(step: { conclusion?: string; status: string }): string {
  if (step.conclusion === 'success') return '\u2713';
  if (step.conclusion === 'failure') return '\u2717';
  if (step.status === 'in_progress') return '\u25D1';
  if (step.conclusion === 'skipped') return '\u2013';
  return '\u25CB';
}

export default function RunDetailPage({ params }: RunDetailPageProps) {
  const { id } = use(params);
  const { data: run, isLoading } = useWorkflowRun(id);
  const { data: artifacts } = useRunArtifacts(id);
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());

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

  if (!run) {
    return (
      <div className="p-3">
        <p style={{ fontSize: 'var(--dp-font-sm)', color: 'var(--dp-text-tertiary)', marginBottom: '8px' }}>
          Run not found.
        </p>
        <Link href="/runs" style={{ fontSize: 'var(--dp-font-sm)', color: 'var(--dp-text-tertiary)' }}>
          {'\u2190'} Back
        </Link>
      </div>
    );
  }

  const duration = run.status === 'completed' ? formatDuration(run.createdAt, run.updatedAt) : run.status === 'in_progress' ? 'Running...' : 'Pending';
  const conclusionColor = run.conclusion === 'success' ? 'var(--dp-accent-success)' : run.conclusion === 'failure' ? 'var(--dp-accent-error)' : 'var(--dp-accent-info)';

  const toggleJob = (jobId: string) => {
    setExpandedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  return (
    <div className="p-3">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 mb-2" style={{ fontSize: 'var(--dp-font-sm)' }}>
        <Link href="/runs" className="hover:underline" style={{ color: 'var(--dp-text-tertiary)' }}>
          {'\u2190'} Runs
        </Link>
        <span style={{ color: 'var(--dp-text-tertiary)' }}>/</span>
        <span style={{ fontWeight: 600, color: 'var(--dp-text-primary)' }}>{run.workflow}</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <h1 style={{ fontSize: 'var(--dp-font-xl)', fontWeight: 600 }}>{run.workflow}</h1>
        <span
          className="px-1 rounded"
          style={{
            fontSize: 'var(--dp-font-xs)',
            fontFamily: 'var(--dp-font-mono)',
            color: conclusionColor,
            backgroundColor: `${conclusionColor}18`,
          }}
        >
          {run.conclusion || run.status}
        </span>
      </div>

      <div className="flex items-center gap-3 mb-3" style={{ fontSize: 'var(--dp-font-xs)', fontFamily: 'var(--dp-font-mono)', color: 'var(--dp-text-tertiary)' }}>
        <span>{run.trigger.ref.replace('refs/heads/', '')}</span>
        <span>{'\u00B7'}</span>
        <span>{run.trigger.sha}</span>
        <span>{'\u00B7'}</span>
        <span>{duration}</span>
        <span>{'\u00B7'}</span>
        <span>{run.trigger.event}</span>
      </div>

      {/* Jobs */}
      <div style={{ borderTop: '1px solid var(--dp-border-subtle)', paddingTop: '8px' }}>
        <h2 style={{ fontSize: 'var(--dp-font-base)', fontWeight: 600, marginBottom: '4px' }}>Jobs</h2>
        {run.jobs.map((job) => {
          const isExpanded = expandedJobs.has(job.id);
          const jobColor = job.conclusion === 'success' ? 'var(--dp-accent-success)' : job.conclusion === 'failure' ? 'var(--dp-accent-error)' : 'var(--dp-accent-info)';

          return (
            <div key={job.id} style={{ borderBottom: '1px solid var(--dp-border-subtle)' }}>
              <button
                onClick={() => toggleJob(job.id)}
                className="flex items-center gap-1.5 w-full px-2 py-1 hover:bg-[var(--dp-bg-hover)] transition-colors text-left"
                style={{ fontSize: 'var(--dp-font-sm)' }}
              >
                <span style={{ fontSize: '9px', color: 'var(--dp-text-tertiary)', width: '10px' }}>
                  {isExpanded ? '\u25BE' : '\u25B8'}
                </span>
                <span style={{ color: jobColor, fontFamily: 'var(--dp-font-mono)' }}>
                  {job.conclusion === 'success' ? '\u2713' : job.conclusion === 'failure' ? '\u2717' : '\u25D1'}
                </span>
                <span style={{ color: 'var(--dp-text-primary)' }}>{job.name}</span>
              </button>

              {isExpanded && (
                <div className="pl-6 pb-1">
                  {job.steps.map((step, si) => (
                    <div key={si} className="py-0.5">
                      <div className="flex items-center gap-1.5 px-2" style={{ fontSize: 'var(--dp-font-sm)', fontFamily: 'var(--dp-font-mono)' }}>
                        <span style={{ color: getStepColor(step) }}>{getStepIcon(step)}</span>
                        <span style={{ color: 'var(--dp-text-secondary)' }}>{step.name}</span>
                      </div>
                      {step.log && (
                        <pre
                          className="mx-2 mt-0.5 px-2 py-1 rounded overflow-x-auto whitespace-pre-wrap"
                          style={{
                            fontSize: 'var(--dp-font-xs)',
                            fontFamily: 'var(--dp-font-mono)',
                            backgroundColor: 'var(--dp-bg-primary)',
                            border: '1px solid var(--dp-border-subtle)',
                            color: 'var(--dp-text-secondary)',
                            maxHeight: '200px',
                            overflowY: 'auto',
                          }}
                        >
                          {step.log}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Artifacts */}
      {artifacts && artifacts.length > 0 && (
        <div className="mt-3" style={{ borderTop: '1px solid var(--dp-border-subtle)', paddingTop: '8px' }}>
          <h2 style={{ fontSize: 'var(--dp-font-base)', fontWeight: 600, marginBottom: '4px' }}>Artifacts</h2>
          <div className="space-y-0.5">
            {artifacts.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-2 px-2 py-1"
                style={{ fontSize: 'var(--dp-font-sm)', fontFamily: 'var(--dp-font-mono)' }}
              >
                <span style={{ color: 'var(--dp-text-primary)' }}>{a.name}</span>
                <span style={{ color: 'var(--dp-text-tertiary)' }}>{formatBytes(a.size)}</span>
                <span style={{ color: 'var(--dp-text-tertiary)' }}>{a.mimeType}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
