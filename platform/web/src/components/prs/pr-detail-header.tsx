"use client";

import { StatusBadge } from "@/components/shared/status-badge";
import { DateDisplay } from "@/components/shared/date-display";
import { GitBranch } from "lucide-react";
import type { PullRequest } from "@/lib/types";

interface PRDetailHeaderProps {
  pr: PullRequest;
}

export function PRDetailHeader({ pr }: PRDetailHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {pr.title}{" "}
            <span className="text-muted-foreground font-normal">
              #{pr.number}
            </span>
          </h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <StatusBadge status={pr.status} />
            <span className="text-sm text-muted-foreground">
              {pr.author} wants to merge into{" "}
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                {pr.baseBranch}
              </code>
            </span>
          </div>
        </div>
        <DateDisplay
          date={pr.createdAt}
          relative={false}
          className="text-sm text-muted-foreground whitespace-nowrap"
        />
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <GitBranch className="h-4 w-4" />
        <code className="bg-muted px-2 py-0.5 rounded text-xs">
          {pr.branch}
        </code>
        <span>&rarr;</span>
        <code className="bg-muted px-2 py-0.5 rounded text-xs">
          {pr.baseBranch}
        </code>
      </div>

      {pr.description && (
        <div className="prose prose-sm prose-invert max-w-none rounded-lg border bg-muted/30 p-4">
          {pr.description.split("\n").map((line, i) => {
            if (line.startsWith("## ")) {
              return (
                <h3 key={i} className="text-sm font-semibold mt-3 mb-1">
                  {line.replace("## ", "")}
                </h3>
              );
            }
            if (line.startsWith("- ")) {
              return (
                <p key={i} className="text-sm text-muted-foreground ml-2">
                  &bull; {line.replace("- ", "")}
                </p>
              );
            }
            if (line.trim() === "") return <br key={i} />;
            return (
              <p key={i} className="text-sm text-muted-foreground">
                {line}
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}
