"use client";

import { cn } from "@/lib/utils";

interface LoadingSkeletonProps {
  className?: string;
  lines?: number;
}

function SkeletonLine({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-4 rounded bg-muted animate-pulse",
        className
      )}
    />
  );
}

export function LoadingSkeleton({ className, lines = 3 }: LoadingSkeletonProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine
          key={i}
          className={i === lines - 1 ? "w-2/3" : "w-full"}
        />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <SkeletonLine className="h-6 w-1/3" />
      <SkeletonLine className="h-10 w-1/2" />
      <SkeletonLine className="h-4 w-2/3" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-4 py-3 border-b">
        <SkeletonLine className="h-4 w-16" />
        <SkeletonLine className="h-4 flex-1" />
        <SkeletonLine className="h-4 w-24" />
        <SkeletonLine className="h-4 w-20" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-3">
          <SkeletonLine className="h-4 w-16" />
          <SkeletonLine className="h-4 flex-1" />
          <SkeletonLine className="h-4 w-24" />
          <SkeletonLine className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}
