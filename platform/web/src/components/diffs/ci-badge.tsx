"use client";

import { cn } from "@/lib/utils";

interface CIBadgeProps {
  status: "pending" | "passed" | "failed" | null;
  className?: string;
}

export function CIBadge({ status, className }: CIBadgeProps) {
  if (status === null) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs text-zinc-500",
          className
        )}
      >
        <span className="text-[10px]">{"\u25CB"}</span>
        no ci
      </span>
    );
  }

  if (status === "pending") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs text-yellow-400",
          className
        )}
      >
        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-yellow-400/30 border-t-yellow-400" />
        running
      </span>
    );
  }

  if (status === "passed") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs text-emerald-400",
          className
        )}
      >
        <span>{"\u2713"}</span>
        passed
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs text-red-400",
        className
      )}
    >
      <span>{"\u2717"}</span>
      failed
    </span>
  );
}
