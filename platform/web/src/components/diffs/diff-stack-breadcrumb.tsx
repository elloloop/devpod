"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { StackedDiff } from "@/lib/types";

interface DiffStackBreadcrumbProps {
  diffs: StackedDiff[];
  currentUuid: string;
  featureSlug?: string;
  className?: string;
}

const statusIcon: Record<string, string> = {
  draft: "\u25CB",
  submitted: "\u25D1",
  approved: "\u2713",
  landed: "\u25CF",
};

const statusColor: Record<string, string> = {
  draft: "text-zinc-400",
  submitted: "text-blue-400",
  approved: "text-emerald-400",
  landed: "text-purple-400",
};

export function DiffStackBreadcrumb({
  diffs,
  currentUuid,
  featureSlug = "",
  className,
}: DiffStackBreadcrumbProps) {
  return (
    <div className={cn("flex items-center gap-1 text-sm", className)}>
      <span className="text-muted-foreground mr-1">Stack:</span>
      {diffs.map((diff, i) => {
        const isCurrent = diff.uuid === currentUuid;

        return (
          <span key={diff.uuid} className="flex items-center gap-1">
            {i > 0 && (
              <span className="text-muted-foreground mx-0.5">{"\u2192"}</span>
            )}
            <Link
              href={`/diffs/${featureSlug}/${diff.position}`}
              className={cn(
                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-xs transition-colors",
                isCurrent
                  ? "bg-primary/20 text-primary ring-1 ring-primary/30"
                  : "hover:bg-accent text-muted-foreground hover:text-foreground"
              )}
            >
              <span>D{diff.position}</span>
              <span className={cn("text-[11px]", statusColor[diff.status])}>
                {statusIcon[diff.status] || "\u25CB"}
              </span>
            </Link>
          </span>
        );
      })}
    </div>
  );
}
