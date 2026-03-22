"use client";

import { useState } from "react";
import { useFeatures } from "@/lib/hooks/use-features";
import { FeatureTimeline } from "@/components/features/feature-timeline";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/shared/loading-skeleton";
import type { Feature } from "@/lib/types";

const statuses = ["all", "in-progress", "review", "shipped"] as const;
type FilterStatus = (typeof statuses)[number];

export default function FeaturesPage() {
  const [filter, setFilter] = useState<FilterStatus>("all");
  const { data: features, isLoading } = useFeatures();

  const filtered =
    filter === "all"
      ? features ?? []
      : (features ?? []).filter((f) => f.status === filter);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Features</h1>
      </div>

      <div className="flex gap-2">
        {statuses.map((s) => (
          <Button
            key={s}
            variant={filter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(s)}
            className="capitalize"
          >
            {s === "all" ? "All" : s}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No features found with status &ldquo;{filter}&rdquo;.
        </div>
      ) : (
        <FeatureTimeline features={filtered} />
      )}
    </div>
  );
}
