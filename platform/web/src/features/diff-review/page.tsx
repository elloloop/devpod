"use client";

import { use, useEffect, useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDiffBySlugPosition, useFeaturesDiffs, useCompare } from '@/packages/git-client';
import { DiffHeader } from './components/diff-header';
import { FileTree } from './components/file-tree';
import { VersionHistory } from './components/version-history';
import { CompareSelector } from './components/compare-selector';
import type { CompareMode } from './components/compare-selector';
import { DiffTable } from '@/packages/ui/patterns/diff-table';
import type { DiffFile } from '@/packages/diff-engine';

interface DiffReviewPageProps {
  params: Promise<{ slug: string; position: string }>;
}

export default function DiffReviewPage({ params }: DiffReviewPageProps) {
  const { slug, position } = use(params);
  const posNum = parseInt(position, 10);
  const router = useRouter();
  const { data: allFeatures } = useFeaturesDiffs();
  const { data: diff, isLoading, error } = useDiffBySlugPosition(slug, posNum);

  const parentFeature = allFeatures?.find((f) => f.feature.slug === slug);
  const siblingDiffs = parentFeature?.diffs ?? [];

  // Compare mode state
  const [activeCompare, setActiveCompare] = useState<CompareMode>({
    type: 'default',
    label: 'Current diff (default)',
  });

  // Fetch compare diff when in interdiff mode
  const { data: compareResult, isLoading: compareLoading } = useCompare(
    activeCompare.left || '',
    activeCompare.right || ''
  );

  // Reset compare mode when navigating to a different diff
  useEffect(() => {
    setActiveCompare({ type: 'default', label: 'Current diff (default)' });
  }, [slug, position]);

  // Keyboard: n/p for stack navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'n') {
        e.preventDefault();
        const nextPos = posNum + 1;
        const exists = siblingDiffs.find((d) => d.position === nextPos);
        if (exists) router.push(`/diffs/${slug}/${nextPos}`);
      } else if (e.key === 'p') {
        e.preventDefault();
        const prevPos = posNum - 1;
        if (prevPos >= 1) {
          const exists = siblingDiffs.find((d) => d.position === prevPos);
          if (exists) router.push(`/diffs/${slug}/${prevPos}`);
        }
      }
    },
    [posNum, siblingDiffs, slug, router]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const scrollToFile = useCallback((path: string) => {
    const el = document.querySelector(`[data-file-path="${CSS.escape(path)}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleVersionCompare = useCallback(
    (left: string, right: string, leftLabel: string, rightLabel: string) => {
      setActiveCompare({
        type: 'interdiff',
        label: `${leftLabel} \u2192 ${rightLabel}`,
        left,
        right,
        leftLabel,
        rightLabel,
      });
    },
    []
  );

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ backgroundColor: 'var(--dp-bg-primary)' }}
      >
        <div className="flex flex-col items-center gap-1.5">
          <div
            className="h-4 w-4 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'var(--dp-text-tertiary)', borderTopColor: 'transparent' }}
          />
          <span style={{ fontFamily: 'var(--dp-font-mono)', fontSize: 'var(--dp-font-sm)', color: 'var(--dp-text-tertiary)' }}>
            Loading diff...
          </span>
        </div>
      </div>
    );
  }

  if (error || !diff) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ backgroundColor: 'var(--dp-bg-primary)' }}
      >
        <div className="text-center">
          <p style={{ fontFamily: 'var(--dp-font-mono)', fontSize: 'var(--dp-font-sm)', color: 'var(--dp-text-tertiary)', marginBottom: '8px' }}>
            {error ? 'Failed to load diff.' : `D${position} not found in ${slug}.`}
          </p>
          <Link
            href={`/diffs/${slug}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded"
            style={{
              fontFamily: 'var(--dp-font-mono)',
              fontSize: 'var(--dp-font-sm)',
              color: 'var(--dp-diff-hunk-text)',
              border: '1px solid var(--dp-border-default)',
            }}
          >
            {'\u2190'} Back to {parentFeature?.feature.name || slug}
          </Link>
        </div>
      </div>
    );
  }

  // Determine which files to show based on compare mode
  const isComparing = activeCompare.type !== 'default' && compareResult;
  const files: DiffFile[] = isComparing
    ? compareResult.files
    : (diff.detailedFiles ?? diff.files);
  const reviewKey = diff.commit || diff.uuid;

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: 'var(--dp-bg-primary)' }}>
      <DiffHeader
        diff={diff}
        featureSlug={slug}
        featureName={parentFeature?.feature.name || slug}
        siblingDiffs={siblingDiffs}
        compareSelector={
          <CompareSelector
            slug={slug}
            position={posNum}
            siblingDiffs={siblingDiffs}
            currentVersion={diff.version}
            activeCompare={activeCompare}
            onCompareChange={setActiveCompare}
          />
        }
      />

      <div className="flex-1 overflow-auto">
        {/* Version History Panel */}
        <VersionHistory
          slug={slug}
          position={posNum}
          currentVersion={diff.version}
          onCompare={handleVersionCompare}
        />

        {/* Compare mode banner */}
        {isComparing && (
          <div
            className="flex items-center gap-1.5 px-2"
            style={{
              height: '28px',
              backgroundColor: 'rgba(99, 102, 241, 0.08)',
              borderBottom: '1px solid rgba(99, 102, 241, 0.2)',
              fontFamily: 'var(--dp-font-mono)',
              fontSize: 'var(--dp-font-xs)',
              color: 'var(--dp-accent-primary)',
            }}
          >
            <span>{'\u2194'}</span>
            <span>Comparing: {activeCompare.leftLabel} {'\u2192'} {activeCompare.rightLabel}</span>
            <span style={{ color: 'var(--dp-text-tertiary)' }}>
              {'\u00B7'} {compareResult.files.length} files changed
            </span>
            <button
              className="ml-auto px-1 rounded hover:bg-[var(--dp-bg-hover)] transition-colors"
              style={{
                fontSize: '10px',
                color: 'var(--dp-text-tertiary)',
                border: '1px solid var(--dp-border-subtle)',
              }}
              onClick={() => setActiveCompare({ type: 'default', label: 'Current diff (default)' })}
            >
              {'\u2715'} Clear
            </button>
          </div>
        )}

        {/* Compare loading state */}
        {activeCompare.type !== 'default' && compareLoading && (
          <div
            className="flex items-center justify-center py-4"
            style={{
              fontFamily: 'var(--dp-font-mono)',
              fontSize: 'var(--dp-font-sm)',
              color: 'var(--dp-text-tertiary)',
            }}
          >
            <div
              className="h-3 w-3 border-2 border-t-transparent rounded-full animate-spin mr-2"
              style={{ borderColor: 'var(--dp-text-tertiary)', borderTopColor: 'transparent' }}
            />
            Loading comparison...
          </div>
        )}

        <FileTree files={files} onFileClick={scrollToFile} />

        {diff.description && activeCompare.type === 'default' && (
          <div
            className="px-2 py-1"
            style={{
              borderBottom: '1px solid var(--dp-border-subtle)',
              fontFamily: 'var(--dp-font-sans)',
              fontSize: 'var(--dp-font-sm)',
              color: 'var(--dp-text-tertiary)',
            }}
          >
            {diff.description}
          </div>
        )}

        <DiffTable files={files} reviewKey={reviewKey} onFileClick={scrollToFile} />
      </div>
    </div>
  );
}
