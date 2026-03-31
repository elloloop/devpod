"use client";

import Link from "next/link";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DiffStatusBadge } from "./diff-status-badge";
import { CIBadge } from "./ci-badge";
import { cn } from "@/lib/utils";
import type { FeatureWithDiffs } from "@/lib/types";

interface FeatureStackProps {
  data: FeatureWithDiffs;
}

const typeBadgeColor: Record<string, string> = {
  feature: "bg-blue-400/10 text-blue-400 border-blue-400/20",
  fix: "bg-orange-400/10 text-orange-400 border-orange-400/20",
  docs: "bg-cyan-400/10 text-cyan-400 border-cyan-400/20",
  chore: "bg-zinc-400/10 text-zinc-400 border-zinc-400/20",
};

export function FeatureStack({ data }: FeatureStackProps) {
  const { feature, diffs, isCurrent } = data;
  const diffCount = diffs.length;

  return (
    <Card
      className={cn(
        "overflow-hidden",
        isCurrent && "ring-1 ring-primary/40"
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={cn(
                "h-2 w-2 rounded-full shrink-0",
                isCurrent ? "bg-primary" : "bg-zinc-500"
              )}
            />
            <h2 className="text-base font-semibold truncate">
              {feature.name}
            </h2>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0 h-4 font-normal shrink-0 border",
                typeBadgeColor[feature.type] || typeBadgeColor.chore
              )}
            >
              {feature.type}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {diffCount} {diffCount === 1 ? "diff" : "diffs"}
          </span>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Diff stack with vertical connecting line */}
        <div className="relative ml-1">
          {diffs.map((diff, i) => {
            const isLast = i === diffs.length - 1;

            return (
              <div key={diff.uuid} className="relative flex gap-3">
                {/* Vertical line + node */}
                <div className="flex flex-col items-center shrink-0 w-6">
                  {/* Position label */}
                  <span className="text-[10px] font-mono font-bold text-muted-foreground leading-none mb-1 mt-0.5">
                    D{diff.position}
                  </span>
                  {/* Connecting line */}
                  {!isLast && (
                    <div className="flex-1 w-px bg-border min-h-[16px]" />
                  )}
                </div>

                {/* Diff row */}
                <Link
                  href={`/diffs/${feature.slug}/${diff.position}`}
                  className="flex-1 group rounded-md px-3 py-2 -mx-1 transition-colors hover:bg-accent/50 mb-1 min-w-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                        {diff.title}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="font-mono">
                          <span className="text-emerald-400/70">
                            +{diff.additions}
                          </span>
                          {diff.deletions > 0 && (
                            <>
                              /
                              <span className="text-red-400/70">
                                -{diff.deletions}
                              </span>
                            </>
                          )}
                        </span>
                        <span>
                          {diff.files.length}{" "}
                          {diff.files.length === 1 ? "file" : "files"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <CIBadge status={diff.ci} />
                      <DiffStatusBadge status={diff.status} />
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
