"use client";

import { cn } from "@/lib/utils";

interface DiffStatusBadgeProps {
  status: "draft" | "submitted" | "approved" | "landed";
  className?: string;
}

const statusConfig = {
  draft: {
    icon: "\u25CB",
    label: "draft",
    classes: "text-zinc-400 bg-zinc-400/10 border-zinc-400/20",
  },
  submitted: {
    icon: "\u25D1",
    label: "submitted",
    classes: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  },
  approved: {
    icon: "\u2713",
    label: "approved",
    classes: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  },
  landed: {
    icon: "\u25CF",
    label: "landed",
    classes: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  },
} as const;

export function DiffStatusBadge({ status, className }: DiffStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
        config.classes,
        className
      )}
    >
      <span className="text-[11px]">{config.icon}</span>
      {config.label}
    </span>
  );
}
