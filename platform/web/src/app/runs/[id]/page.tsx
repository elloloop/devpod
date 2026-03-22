"use client";

import { use } from "react";
import Link from "next/link";
import { useWorkflowRun, useRunArtifacts } from "@/lib/hooks/use-runs";
import { JobList } from "@/components/runs/job-list";
import { StatusBadge } from "@/components/shared/status-badge";
import { DateDisplay } from "@/components/shared/date-display";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  GitBranch,
  Clock,
  Download,
  FileArchive,
} from "lucide-react";
import { differenceInSeconds, parseISO } from "date-fns";

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

export default function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: run, isLoading } = useWorkflowRun(id);
  const { data: artifacts } = useRunArtifacts(id);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <LoadingSkeleton lines={8} />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Workflow run not found.</p>
          <Link href="/runs">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Runs
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const duration =
    run.status === "completed"
      ? formatDuration(run.createdAt, run.updatedAt)
      : run.status === "in_progress"
        ? "Running..."
        : "Pending";

  return (
    <div className="p-6 space-y-6">
      <Link href="/runs">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Runs
        </Button>
      </Link>

      {/* Run header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">{run.workflow}</h1>
          <StatusBadge status={run.conclusion || run.status} />
        </div>

        <div className="flex items-center gap-6 text-sm text-muted-foreground flex-wrap">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            <code className="bg-muted px-2 py-0.5 rounded text-xs">
              {run.trigger.ref.replace("refs/heads/", "")}
            </code>
          </div>
          <div className="flex items-center gap-2">
            <span>Trigger:</span>
            <code className="bg-muted px-2 py-0.5 rounded text-xs">
              {run.trigger.event}
            </code>
          </div>
          <div className="flex items-center gap-2">
            <span>SHA:</span>
            <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono">
              {run.trigger.sha}
            </code>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>{duration}</span>
          </div>
          <DateDisplay date={run.createdAt} />
        </div>
      </div>

      <Separator />

      {/* Jobs */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Jobs</h2>
        <JobList jobs={run.jobs} />
      </div>

      {/* Artifacts */}
      {artifacts && artifacts.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Artifacts</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {artifacts.map((artifact) => (
                <Card key={artifact.id}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <FileArchive className="h-8 w-8 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {artifact.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(artifact.size)} &middot;{" "}
                        {artifact.mimeType}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0">
                      <Download className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
