"use client";

import { use, useState } from "react";
import Link from "next/link";
import { usePullRequest } from "@/lib/hooks/use-prs";
import { PRDetailHeader } from "@/components/prs/pr-detail-header";
import { DiffViewer } from "@/components/prs/diff-viewer";
import { ChecksPanel } from "@/components/prs/checks-panel";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, CheckCircle2, MessageSquare, Film } from "lucide-react";

export default function PRDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const prId = parseInt(id, 10);
  const { data: pr, isLoading } = usePullRequest(prId);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewAction, setReviewAction] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <LoadingSkeleton lines={8} />
      </div>
    );
  }

  if (!pr) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            Pull request not found.
          </p>
          <Link href="/prs">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Pull Requests
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmitReview = (action: "approve" | "request_changes") => {
    setReviewAction(action);
    // Store locally for now
    localStorage.setItem(
      `pr-review-${pr.number}`,
      JSON.stringify({
        action,
        comment: reviewComment,
        timestamp: new Date().toISOString(),
      })
    );
    setReviewComment("");
  };

  return (
    <div className="p-6 space-y-6">
      <Link href="/prs">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Pull Requests
        </Button>
      </Link>

      <PRDetailHeader pr={pr} />

      <Tabs defaultValue="changes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="changes">Changes</TabsTrigger>
          <TabsTrigger value="checks">Checks</TabsTrigger>
          <TabsTrigger value="feature">Feature</TabsTrigger>
        </TabsList>

        <TabsContent value="changes">
          <DiffViewer pr={pr} />
        </TabsContent>

        <TabsContent value="checks">
          <ChecksPanel checks={pr.checks} />
        </TabsContent>

        <TabsContent value="feature">
          {pr.feature ? (
            <Link href={`/features/${pr.feature}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="rounded-lg bg-muted p-4">
                    <Film className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-lg">{pr.feature}</p>
                    <p className="text-sm text-muted-foreground">
                      View feature details and demo video
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No feature associated with this PR.
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Separator />

      {/* Review section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Review</h2>

        {reviewAction && (
          <div className="rounded-lg border bg-muted/30 p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <p className="text-sm">
              You{" "}
              {reviewAction === "approve"
                ? "approved"
                : "requested changes on"}{" "}
              this PR.
            </p>
          </div>
        )}

        <div className="space-y-3">
          <Textarea
            placeholder="Leave a review comment..."
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            rows={3}
          />
          <div className="flex gap-2">
            <Button
              variant="default"
              onClick={() => handleSubmitReview("approve")}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Approve
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSubmitReview("request_changes")}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Request Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
