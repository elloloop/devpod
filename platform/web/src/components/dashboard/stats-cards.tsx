"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Film, GitPullRequest, Play, CheckCircle2 } from "lucide-react";
import type { Feature, PullRequest, WorkflowRun } from "@/lib/types";

interface StatsCardsProps {
  features: Feature[];
  prs: PullRequest[];
  runs: WorkflowRun[];
}

export function StatsCards({ features, prs, runs }: StatsCardsProps) {
  const openPrs = prs.filter((pr) => pr.status === "open").length;
  const completedRuns = runs.filter((r) => r.status === "completed").length;
  const passRate =
    completedRuns > 0
      ? Math.round(
          (runs.filter((r) => r.conclusion === "success").length /
            completedRuns) *
            100
        )
      : 0;

  const stats = [
    {
      title: "Total Features",
      value: features.length,
      description: `${features.filter((f) => f.status === "shipped").length} shipped`,
      icon: Film,
      iconColor: "text-blue-400",
    },
    {
      title: "Open PRs",
      value: openPrs,
      description: `${prs.length} total`,
      icon: GitPullRequest,
      iconColor: "text-purple-400",
    },
    {
      title: "Recent Runs",
      value: runs.length,
      description: `${runs.filter((r) => r.status === "in_progress").length} in progress`,
      icon: Play,
      iconColor: "text-yellow-400",
    },
    {
      title: "Pass Rate",
      value: `${passRate}%`,
      description: `${completedRuns} completed runs`,
      icon: CheckCircle2,
      iconColor: "text-emerald-400",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stat.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
