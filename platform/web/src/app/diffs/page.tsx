"use client";

import { useState, useMemo } from "react";
import { useFeaturesDiffs } from "@/lib/hooks/use-diffs";
import { FeatureStack } from "@/components/diffs/feature-stack";
import { Input } from "@/components/ui/input";
import { CardSkeleton } from "@/components/shared/loading-skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

const filterOptions = [
  { value: "all", label: "All features" },
  { value: "active", label: "Active" },
  { value: "submitted", label: "Submitted" },
  { value: "complete", label: "Complete" },
] as const;
type FilterOption = (typeof filterOptions)[number]["value"];

export default function DiffsPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterOption>("all");
  const { data: features, isLoading, error } = useFeaturesDiffs();

  const filtered = useMemo(() => {
    let result = features ?? [];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (f) =>
          f.feature.name.toLowerCase().includes(q) ||
          f.feature.branch.toLowerCase().includes(q) ||
          f.diffs.some((d) => d.title.toLowerCase().includes(q))
      );
    }

    if (filter !== "all") {
      result = result.filter((f) => f.feature.status === filter);
    }

    // Sort: current feature first, then by most recent diff update
    result = [...result].sort((a, b) => {
      if (a.isCurrent && !b.isCurrent) return -1;
      if (!a.isCurrent && b.isCurrent) return 1;

      const aLatest = a.diffs.length
        ? Math.max(...a.diffs.map((d) => new Date(d.updated).getTime()))
        : 0;
      const bLatest = b.diffs.length
        ? Math.max(...b.diffs.map((d) => new Date(d.updated).getTime()))
        : 0;
      return bLatest - aLatest;
    });

    return result;
  }, [features, search, filter]);

  const totalDiffs = (features ?? []).reduce(
    (sum, f) => sum + f.diffs.length,
    0
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Stacked Diffs</h1>
        <span className="text-sm text-muted-foreground">
          {features?.length ?? 0} features, {totalDiffs} diffs
        </span>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search features or diffs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={filter}
          onValueChange={(v) => setFilter(v as FilterOption)}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {filterOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12 text-red-400">
          Failed to load diffs. Make sure the workspace is accessible.
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No features found.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((feature) => (
            <FeatureStack
              key={feature.feature.slug}
              data={feature}
            />
          ))}
        </div>
      )}
    </div>
  );
}
