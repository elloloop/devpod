"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/shared/loading-skeleton";
import { Film, GitPullRequest, Play, ArrowRight } from "lucide-react";
import {
  mockFeatures,
  mockPullRequests,
  mockWorkflowRuns,
  mockActivity,
} from "@/lib/mock-data";
import type {
  Feature,
  PullRequest,
  WorkflowRun,
  ActivityItem,
} from "@/lib/types";

async function fetchDashboardData() {
  const [features, prs, runs, activity] = await Promise.all([
    fetch("/api/features")
      .then((r) => (r.ok ? r.json() : mockFeatures))
      .catch(() => mockFeatures) as Promise<Feature[]>,
    fetch("/api/prs")
      .then((r) => (r.ok ? r.json() : mockPullRequests))
      .catch(() => mockPullRequests) as Promise<PullRequest[]>,
    Promise.resolve(mockWorkflowRuns) as Promise<WorkflowRun[]>,
    Promise.resolve(mockActivity) as Promise<ActivityItem[]>,
  ]);
  return { features, prs, runs, activity };
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboardData,
  });

  if (isLoading || !data) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
      </div>

      <StatsCards
        features={data.features}
        prs={data.prs}
        runs={data.runs}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActivityFeed activity={data.activity} />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/features">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3"
                >
                  <Film className="h-4 w-4 text-blue-400" />
                  <span className="flex-1 text-left">Features</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Button>
              </Link>
              <Link href="/prs">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3"
                >
                  <GitPullRequest className="h-4 w-4 text-purple-400" />
                  <span className="flex-1 text-left">Pull Requests</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Button>
              </Link>
              <Link href="/runs">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3"
                >
                  <Play className="h-4 w-4 text-yellow-400" />
                  <span className="flex-1 text-left">Workflow Runs</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Features</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.features.slice(0, 3).map((feature) => (
                <Link
                  key={feature.slug}
                  href={`/features/${feature.slug}`}
                  className="block"
                >
                  <div className="flex items-center gap-3 p-2 rounded-md hover:bg-accent/50 transition-colors">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        feature.status === "shipped"
                          ? "bg-emerald-500"
                          : feature.status === "review"
                            ? "bg-blue-500"
                            : "bg-yellow-500"
                      }`}
                    />
                    <span className="text-sm truncate">{feature.title}</span>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
