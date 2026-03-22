"use client";

import { useState, useMemo } from "react";
import { usePullRequests } from "@/lib/hooks/use-prs";
import { PRTable } from "@/components/prs/pr-table";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const statusFilters = ["all", "open", "merged", "closed"] as const;
type StatusFilter = (typeof statusFilters)[number];

const sortOptions = [
  { value: "date-desc", label: "Newest first" },
  { value: "date-asc", label: "Oldest first" },
] as const;
type SortOption = (typeof sortOptions)[number]["value"];

export default function PRsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortOption>("date-desc");
  const { data: prs, isLoading } = usePullRequests();

  const filtered = useMemo(() => {
    let result = prs ?? [];

    if (statusFilter !== "all") {
      result = result.filter((pr) => pr.status === statusFilter);
    }

    result = [...result].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sort === "date-desc" ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [prs, statusFilter, sort]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pull Requests</h1>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-2">
          {statusFilters.map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s)}
              className="capitalize"
            >
              {s}
            </Button>
          ))}
        </div>

        <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No pull requests found.
        </div>
      ) : (
        <PRTable prs={filtered} />
      )}
    </div>
  );
}
