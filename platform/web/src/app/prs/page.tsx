"use client";

import { useState, useMemo } from "react";
import { usePullRequests } from "@/lib/hooks/use-prs";
import { PRTable } from "@/components/prs/pr-table";
import { Input } from "@/components/ui/input";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

const sortOptions = [
  { value: "date-desc", label: "Newest first" },
  { value: "date-asc", label: "Oldest first" },
] as const;
type SortOption = (typeof sortOptions)[number]["value"];

export default function PRsPage() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("date-desc");
  const { data: prs, isLoading, error } = usePullRequests();

  const filtered = useMemo(() => {
    let result = prs ?? [];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (pr) =>
          pr.title.toLowerCase().includes(q) ||
          pr.shortSha.toLowerCase().includes(q) ||
          pr.author.toLowerCase().includes(q)
      );
    }

    result = [...result].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sort === "date-desc" ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [prs, search, sort]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Commits</h1>
        <span className="text-sm text-muted-foreground">
          {prs?.length ?? 0} commits from main
        </span>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search commits..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
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
        <TableSkeleton rows={8} />
      ) : error ? (
        <div className="text-center py-12 text-red-400">
          Failed to load commits. Make sure the git repository is accessible.
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No commits found.
        </div>
      ) : (
        <PRTable prs={filtered} />
      )}
    </div>
  );
}
