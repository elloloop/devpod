"use client";

import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Ban,
  SkipForward,
  GitMerge,
  GitPullRequest,
  Eye,
  Rocket,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

type StatusVariant =
  | "success"
  | "failure"
  | "in_progress"
  | "queued"
  | "cancelled"
  | "skipped"
  | "open"
  | "merged"
  | "closed"
  | "shipped"
  | "review"
  | "in-progress"
  | "completed"
  | "failed";

const statusConfig: Record<
  StatusVariant,
  { label: string; className: string; icon: React.ElementType }
> = {
  success: {
    label: "Success",
    className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    icon: CheckCircle2,
  },
  completed: {
    label: "Completed",
    className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    icon: CheckCircle2,
  },
  failure: {
    label: "Failed",
    className: "bg-red-500/15 text-red-400 border-red-500/30",
    icon: XCircle,
  },
  failed: {
    label: "Failed",
    className: "bg-red-500/15 text-red-400 border-red-500/30",
    icon: XCircle,
  },
  in_progress: {
    label: "In Progress",
    className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    icon: Loader2,
  },
  "in-progress": {
    label: "In Progress",
    className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    icon: Wrench,
  },
  queued: {
    label: "Queued",
    className: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
    icon: Clock,
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
    icon: Ban,
  },
  skipped: {
    label: "Skipped",
    className: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
    icon: SkipForward,
  },
  open: {
    label: "Open",
    className: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    icon: GitPullRequest,
  },
  merged: {
    label: "Merged",
    className: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    icon: GitMerge,
  },
  closed: {
    label: "Closed",
    className: "bg-red-500/15 text-red-400 border-red-500/30",
    icon: XCircle,
  },
  shipped: {
    label: "Shipped",
    className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    icon: Rocket,
  },
  review: {
    label: "In Review",
    className: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    icon: Eye,
  },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status as StatusVariant] ?? {
    label: status,
    className: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
    icon: Clock,
  };

  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 font-medium border",
        config.className,
        className
      )}
    >
      <Icon
        className={cn(
          "h-3 w-3",
          status === "in_progress" && "animate-spin"
        )}
      />
      {config.label}
    </Badge>
  );
}
