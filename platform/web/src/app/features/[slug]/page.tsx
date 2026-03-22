"use client";

import { use } from "react";
import Link from "next/link";
import { useFeature } from "@/lib/hooks/use-features";
import { VideoPlayer } from "@/components/features/video-player";
import { ScreenshotGallery } from "@/components/features/screenshot-gallery";
import { StatusBadge } from "@/components/shared/status-badge";
import { DateDisplay } from "@/components/shared/date-display";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ArrowLeft, GitPullRequest } from "lucide-react";

export default function FeatureDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { data: feature, isLoading } = useFeature(slug);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <LoadingSkeleton lines={5} />
      </div>
    );
  }

  if (!feature) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Feature not found.</p>
          <Link href="/features">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Features
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Link href="/features">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Features
        </Button>
      </Link>

      {/* Hero */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl font-bold">{feature.title}</h1>
          <StatusBadge status={feature.status} />
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <DateDisplay date={feature.date} relative={false} />
          <span>
            {feature.prs.length} PR{feature.prs.length !== 1 ? "s" : ""}
          </span>
        </div>
        <p className="text-muted-foreground max-w-3xl leading-relaxed">
          {feature.description}
        </p>
      </div>

      <Separator />

      {/* Video */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Demo Video</h2>
        <VideoPlayer src={feature.video} title={feature.title} />
      </div>

      <Separator />

      {/* Screenshots */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Screenshots</h2>
        <ScreenshotGallery
          screenshots={feature.screenshots}
          title={feature.title}
        />
      </div>

      <Separator />

      {/* Related PRs */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Related Pull Requests</h2>
        <div className="space-y-2">
          {feature.prs.map((pr) => (
            <Link key={pr.number} href={`/prs/${pr.number}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="flex items-center gap-4 p-4">
                  <GitPullRequest className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {pr.title}
                      <span className="text-muted-foreground ml-2">
                        #{pr.number}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">{pr.repo}</p>
                  </div>
                  <StatusBadge status={pr.status} />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
