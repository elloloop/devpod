"use client";

import { use } from "react";
import Link from "next/link";
import { usePullRequest } from "@/lib/hooks/use-prs";
import { PRDetailHeader } from "@/components/prs/pr-detail-header";
import { DiffViewer } from "@/components/prs/diff-viewer";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function PRDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: pr, isLoading, error } = usePullRequest(id);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <LoadingSkeleton lines={8} />
      </div>
    );
  }

  if (error || !pr) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            {error ? "Failed to load commit." : "Commit not found."}
          </p>
          <Link href="/prs">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Commits
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-full">
      <div className="flex items-center gap-2">
        <Link href="/prs">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
      </div>

      <PRDetailHeader pr={pr} />

      <DiffViewer pr={pr} />
    </div>
  );
}
