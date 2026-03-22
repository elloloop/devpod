"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { DateDisplay } from "@/components/shared/date-display";
import { Film, Image as ImageIcon } from "lucide-react";
import type { Feature } from "@/lib/types";

interface FeatureCardProps {
  feature: Feature;
}

export function FeatureCard({ feature }: FeatureCardProps) {
  return (
    <Link href={`/features/${feature.slug}`}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
        <CardContent className="p-6">
          <div className="flex gap-4">
            {/* Thumbnail */}
            <div className="shrink-0 w-32 h-20 rounded-md bg-muted flex items-center justify-center overflow-hidden">
              {feature.video ? (
                <Film className="h-8 w-8 text-muted-foreground" />
              ) : feature.screenshots.length > 0 ? (
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              ) : (
                <div className="h-8 w-8 rounded bg-muted-foreground/20" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="font-semibold truncate">{feature.title}</h3>
                <StatusBadge status={feature.status} />
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {feature.description}
              </p>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <DateDisplay date={feature.date} />
                <span>{feature.prs.length} PR{feature.prs.length !== 1 ? "s" : ""}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
