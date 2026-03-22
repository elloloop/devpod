"use client";

import { FeatureCard } from "./feature-card";
import type { Feature } from "@/lib/types";

interface FeatureTimelineProps {
  features: Feature[];
}

export function FeatureTimeline({ features }: FeatureTimelineProps) {
  const sorted = [...features].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

      <div className="space-y-4">
        {sorted.map((feature, idx) => (
          <div key={feature.slug} className="relative pl-10">
            {/* Timeline dot */}
            <div
              className={`absolute left-2.5 top-6 h-3 w-3 rounded-full border-2 border-background ${
                feature.status === "shipped"
                  ? "bg-emerald-500"
                  : feature.status === "review"
                    ? "bg-blue-500"
                    : "bg-yellow-500"
              }`}
            />
            <FeatureCard feature={feature} />
          </div>
        ))}
      </div>
    </div>
  );
}
