"use client";

import { use } from "react";
import Link from "next/link";
import { useDiffDetail, useFeaturesDiffs } from "@/lib/hooks/use-diffs";
import { DiffViewer } from "@/components/prs/diff-viewer";
import { DiffStackBreadcrumb } from "@/components/diffs/diff-stack-breadcrumb";
import { DiffStatusBadge } from "@/components/diffs/diff-status-badge";
import { CIBadge } from "@/components/diffs/ci-badge";
import { ReviewPanel } from "@/components/diffs/review-panel";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileCode, Plus, Minus } from "lucide-react";
import type { PullRequest } from "@/lib/types";

export default function DiffReviewPage({
  params,
}: {
  params: Promise<{ slug: string; position: string }>;
}) {
  const { slug, position } = use(params);
  const posNum = parseInt(position, 10);
  const { data: allFeatures } = useFeaturesDiffs();

  // Find the feature and diff
  const parentFeature = allFeatures?.find((f) => f.feature.slug === slug);
  const targetDiff = parentFeature?.diffs.find((d) => d.position === posNum);
  const uuid = targetDiff?.uuid || "";

  const { data: diff, isLoading, error } = useDiffDetail(uuid);
  const siblingDiffs = parentFeature?.diffs ?? [];

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <LoadingSkeleton lines={8} />
      </div>
    );
  }

  if (error || !diff) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            {error ? "Failed to load diff." : `D${position} not found in ${slug}.`}
          </p>
          <Link href={`/diffs/${slug}`}>
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to {parentFeature?.feature.name || slug}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Build PullRequest-compatible object for DiffViewer
  const prCompat: PullRequest = {
    sha: diff.commit || diff.uuid,
    shortSha: diff.commit?.substring(0, 7) || "",
    title: diff.title,
    body: diff.description,
    author: "",
    date: diff.updated || diff.created,
    parentSha: "",
    files: diff.detailedFiles ?? diff.files,
    totalAdditions: diff.additions,
    totalDeletions: diff.deletions,
  };

  return (
    <div className="p-4 space-y-4 max-w-full">
      <div className="flex items-center gap-2">
        <Link href={`/diffs/${slug}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {parentFeature?.feature.name || slug}
          </Button>
        </Link>
      </div>

      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm font-bold text-muted-foreground">
                D{diff.position}
              </span>
              <span className="text-muted-foreground">{"\u2014"}</span>
              <h1 className="text-xl font-bold leading-tight truncate">
                {diff.title}
              </h1>
            </div>

            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <DiffStatusBadge status={diff.status} />
              <span className="text-sm text-muted-foreground">{"\u00B7"}</span>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="secondary" className="gap-1 font-mono text-xs">
                  <Plus className="h-3 w-3" />
                  {diff.additions}
                </Badge>
                <Badge variant="secondary" className="gap-1 font-mono text-xs">
                  <Minus className="h-3 w-3" />
                  {diff.deletions}
                </Badge>
              </div>
              <span className="text-sm text-muted-foreground">{"\u00B7"}</span>
              <Badge variant="secondary" className="gap-1 font-mono text-xs">
                <FileCode className="h-3 w-3" />
                {(diff.detailedFiles ?? diff.files).length} files
              </Badge>
              <span className="text-sm text-muted-foreground">{"\u00B7"}</span>
              <span className="text-xs text-muted-foreground">
                version {diff.version}
              </span>
              <span className="text-sm text-muted-foreground">{"\u00B7"}</span>
              <CIBadge status={diff.ci} />
            </div>
          </div>
        </div>

        {siblingDiffs.length > 0 && (
          <DiffStackBreadcrumb
            diffs={siblingDiffs}
            currentUuid={uuid}
            featureSlug={slug}
          />
        )}

        {diff.description && (
          <div className="rounded-lg border bg-muted/30 p-4">
            <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans">
              {diff.description}
            </pre>
          </div>
        )}
      </div>

      <DiffViewer pr={prCompat} />

      <ReviewPanel uuid={uuid} featureSlug={slug} position={posNum} status={diff.status} />
    </div>
  );
}
