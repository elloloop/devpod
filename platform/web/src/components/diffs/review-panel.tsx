"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useApproveDiff, useRejectDiff } from "@/lib/hooks/use-diffs";
import { cn } from "@/lib/utils";

interface ReviewPanelProps {
  uuid: string;
  status: string;
  className?: string;
}

export function ReviewPanel({ uuid, status, className }: ReviewPanelProps) {
  const [comment, setComment] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const approveMutation = useApproveDiff();
  const rejectMutation = useRejectDiff();

  const handleApprove = async () => {
    try {
      await approveMutation.mutateAsync(uuid);
      setFeedback({ type: "success", message: "Diff approved" });
      setComment("");
    } catch {
      setFeedback({ type: "error", message: "Failed to approve" });
    }
  };

  const handleReject = async () => {
    try {
      await rejectMutation.mutateAsync({ uuid, comment });
      setFeedback({ type: "success", message: "Changes requested" });
      setComment("");
    } catch {
      setFeedback({ type: "error", message: "Failed to request changes" });
    }
  };

  return (
    <div
      className={cn("rounded-lg border bg-card p-4 space-y-4", className)}
    >
      <h3 className="text-sm font-semibold">Review</h3>

      {status === "approved" && (
        <div className="rounded-md bg-emerald-400/10 border border-emerald-400/20 px-3 py-2 text-xs text-emerald-400">
          This diff has been approved.
        </div>
      )}

      {status === "landed" && (
        <div className="rounded-md bg-purple-400/10 border border-purple-400/20 px-3 py-2 text-xs text-purple-400">
          This diff has been landed.
        </div>
      )}

      <Textarea
        placeholder="Add review notes..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="min-h-[80px] text-sm"
      />

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleApprove}
          disabled={approveMutation.isPending || status === "landed"}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {approveMutation.isPending ? "Approving..." : "Approve"}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={handleReject}
          disabled={rejectMutation.isPending || status === "landed"}
        >
          {rejectMutation.isPending ? "Submitting..." : "Request Changes"}
        </Button>
      </div>

      {feedback && (
        <div
          className={cn(
            "rounded-md px-3 py-2 text-xs",
            feedback.type === "success"
              ? "bg-emerald-400/10 text-emerald-400"
              : "bg-red-400/10 text-red-400"
          )}
        >
          {feedback.message}
        </div>
      )}
    </div>
  );
}
