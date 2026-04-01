"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import type { DiffDetail, StackedDiff } from "@/lib/types";

interface DiffHeaderProps {
  diff: DiffDetail;
  featureSlug: string;
  featureName: string;
  siblingDiffs: StackedDiff[];
}

const statusIcon: Record<string, string> = {
  draft: "\u25CB",
  submitted: "\u25D1",
  approved: "\u2713",
  landed: "\u25CF",
};

const statusColor: Record<string, string> = {
  draft: "var(--diff-fg-muted)",
  submitted: "#58a6ff",
  approved: "var(--diff-line-add-text)",
  landed: "#a371f7",
};

const ciLabel: Record<string, { icon: string; color: string }> = {
  passed: { icon: "\u2713", color: "var(--diff-line-add-text)" },
  failed: { icon: "\u2717", color: "var(--diff-line-del-text)" },
  pending: { icon: "\u25D1", color: "#d29922" },
};

export function DiffHeader({
  diff,
  featureSlug,
  featureName,
  siblingDiffs,
}: DiffHeaderProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const files = diff.detailedFiles ?? diff.files;
  const basePath = `/api/diffs/${featureSlug}/${diff.position}`;

  const handleApprove = async () => {
    setLoading("approve");
    try {
      await fetch(`${basePath}/approve`, { method: "POST" });
      setFeedback("Approved");
      queryClient.invalidateQueries({ queryKey: ["diffs"] });
    } catch {
      setFeedback("Failed");
    }
    setLoading(null);
    setTimeout(() => setFeedback(null), 2000);
  };

  const handleReject = async () => {
    setLoading("reject");
    try {
      await fetch(`${basePath}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: "" }),
      });
      setFeedback("Changes requested");
      queryClient.invalidateQueries({ queryKey: ["diffs"] });
    } catch {
      setFeedback("Failed");
    }
    setLoading(null);
    setTimeout(() => setFeedback(null), 2000);
  };

  return (
    <>
      {/* Main header bar — 36px */}
      <div
        className="sticky top-0 z-30 flex items-center gap-2 px-3 font-mono text-xs"
        style={{
          height: "36px",
          minHeight: "36px",
          backgroundColor: "var(--diff-bg-subtle)",
          borderBottom: "1px solid var(--diff-border)",
          color: "var(--diff-fg)",
        }}
      >
        <Link
          href={`/diffs/${featureSlug}`}
          className="flex items-center gap-1 shrink-0 hover:underline"
          style={{ color: "var(--diff-fg-muted)" }}
        >
          <ArrowLeft className="h-3 w-3" />
          <span>{featureName}</span>
        </Link>

        <span style={{ color: "var(--diff-fg-muted)" }}>&middot;</span>
        <span className="font-bold">D{diff.position}</span>
        <span style={{ color: "var(--diff-fg-muted)" }}>&middot;</span>
        <span className="truncate min-w-0 flex-1" style={{ color: "var(--diff-fg)" }}>
          {diff.title}
        </span>

        <span className="shrink-0 flex items-center gap-1.5">
          <span style={{ color: "var(--diff-line-add-text)" }}>+{diff.additions}</span>
          <span style={{ color: "var(--diff-line-del-text)" }}>/-{diff.deletions}</span>
          <span style={{ color: "var(--diff-fg-muted)" }}>&middot;</span>
          <span style={{ color: "var(--diff-fg-muted)" }}>{files.length} {files.length === 1 ? "file" : "files"}</span>
          <span style={{ color: "var(--diff-fg-muted)" }}>&middot;</span>

          {/* Status */}
          <span style={{ color: statusColor[diff.status] }}>
            {statusIcon[diff.status]} {diff.status}
          </span>

          {/* CI */}
          {diff.ci && (
            <>
              <span style={{ color: "var(--diff-fg-muted)" }}>&middot;</span>
              <span style={{ color: ciLabel[diff.ci]?.color }}>
                {ciLabel[diff.ci]?.icon} CI {diff.ci}
              </span>
            </>
          )}

          <span style={{ color: "var(--diff-fg-muted)" }}>&middot;</span>

          {/* Action buttons */}
          <button
            onClick={handleApprove}
            disabled={loading !== null || diff.status === "landed"}
            className="px-2 py-0.5 rounded text-[11px] font-sans font-medium transition-colors disabled:opacity-40"
            style={{
              backgroundColor: "rgba(63, 185, 80, 0.15)",
              color: "var(--diff-line-add-text)",
              border: "1px solid rgba(63, 185, 80, 0.3)",
            }}
          >
            {loading === "approve" ? "..." : "Approve"}
          </button>
          <button
            onClick={handleReject}
            disabled={loading !== null || diff.status === "landed"}
            className="px-2 py-0.5 rounded text-[11px] font-sans font-medium transition-colors disabled:opacity-40"
            style={{
              backgroundColor: "rgba(248, 81, 73, 0.15)",
              color: "var(--diff-line-del-text)",
              border: "1px solid rgba(248, 81, 73, 0.3)",
            }}
          >
            {loading === "reject" ? "..." : "Request Changes"}
          </button>

          {feedback && (
            <span className="text-[10px] font-sans" style={{ color: "var(--diff-line-add-text)" }}>
              {feedback}
            </span>
          )}
        </span>
      </div>

      {/* Stack nav bar — 28px */}
      {siblingDiffs.length > 1 && (
        <div
          className="flex items-center gap-1 px-3 font-mono text-[11px]"
          style={{
            height: "28px",
            minHeight: "28px",
            backgroundColor: "var(--diff-bg)",
            borderBottom: "1px solid var(--diff-border)",
            color: "var(--diff-fg-muted)",
          }}
        >
          {siblingDiffs.map((d, i) => {
            const isCurrent = d.uuid === diff.uuid;
            return (
              <span key={d.uuid} className="flex items-center gap-0.5">
                {i > 0 && <span className="mx-1">{"\u2192"}</span>}
                <Link
                  href={`/diffs/${featureSlug}/${d.position}`}
                  className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded transition-colors"
                  style={{
                    backgroundColor: isCurrent ? "rgba(88, 166, 255, 0.15)" : "transparent",
                    color: isCurrent ? "#58a6ff" : "var(--diff-fg-muted)",
                    border: isCurrent ? "1px solid rgba(88, 166, 255, 0.3)" : "1px solid transparent",
                  }}
                >
                  D{d.position}
                  <span style={{ color: statusColor[d.status] }}>{statusIcon[d.status]}</span>
                </Link>
              </span>
            );
          })}
          <span className="ml-auto text-[10px]" style={{ color: "var(--diff-fg-muted)" }}>
            n/p to navigate
          </span>
        </div>
      )}
    </>
  );
}
