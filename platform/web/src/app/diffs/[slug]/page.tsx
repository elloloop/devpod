"use client";

import { use } from "react";
import Link from "next/link";
import { useFeaturesDiffs } from "@/lib/hooks/use-diffs";
import { DiffStatusBadge } from "@/components/diffs/diff-status-badge";
import { CIBadge } from "@/components/diffs/ci-badge";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export default function FeatureDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { data: features, isLoading } = useFeaturesDiffs();

  const feature = features?.find((f) => f.feature.slug === slug);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <LoadingSkeleton lines={8} />
      </div>
    );
  }

  if (!feature) {
    return (
      <div className="p-6 text-center py-12">
        <p className="text-muted-foreground mb-4">Feature not found.</p>
        <Link href="/diffs">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Diffs
          </Button>
        </Link>
      </div>
    );
  }

  const { diffs } = feature;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/diffs">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
      </div>

      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{feature.feature.name}</h1>
          <Badge variant="outline">{feature.feature.type}</Badge>
          {feature.isCurrent && (
            <Badge className="bg-primary/20 text-primary text-xs">
              current
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {diffs.length} {diffs.length === 1 ? "diff" : "diffs"} on{" "}
          <code className="text-xs">{feature.feature.branch}</code>
        </p>
      </div>

      <div className="space-y-2">
        {diffs.map((diff, i) => (
          <Link
            key={diff.uuid}
            href={`/diffs/${slug}/${diff.position}`}
          >
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-sm font-bold text-muted-foreground w-8">
                      D{diff.position}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {diff.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <span className="text-emerald-400/70 font-mono">
                          +{diff.additions}
                        </span>
                        {diff.deletions > 0 && (
                          <span className="text-red-400/70 font-mono">
                            /{"-"}
                            {diff.deletions}
                          </span>
                        )}{" "}
                        · {diff.files.length}{" "}
                        {diff.files.length === 1 ? "file" : "files"}
                        {diff.version > 1 && ` · v${diff.version}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <CIBadge status={diff.ci} />
                    <DiffStatusBadge status={diff.status} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
