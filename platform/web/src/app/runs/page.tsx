"use client";

import { useState, useMemo } from "react";
import { useWorkflowRuns } from "@/lib/hooks/use-runs";
import { RunTable } from "@/components/runs/run-table";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Wifi } from "lucide-react";

const statusFilters = [
  "all",
  "completed",
  "in_progress",
  "queued",
  "failed",
] as const;
type StatusFilter = (typeof statusFilters)[number];

const statusLabels: Record<string, string> = {
  all: "All",
  completed: "Completed",
  in_progress: "In Progress",
  queued: "Queued",
  failed: "Failed",
};

export default function RunsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [workflowFilter, setWorkflowFilter] = useState<string>("all");
  const { data: runs, isLoading } = useWorkflowRuns();

  const workflows = useMemo(() => {
    if (!runs) return [];
    const unique = [...new Set(runs.map((r) => r.workflow))];
    return unique.sort();
  }, [runs]);

  const filtered = useMemo(() => {
    let result = runs ?? [];

    if (statusFilter !== "all") {
      if (statusFilter === "failed") {
        result = result.filter(
          (r) => r.status === "completed" && r.conclusion === "failure"
        );
      } else {
        result = result.filter((r) => r.status === statusFilter);
      }
    }

    if (workflowFilter !== "all") {
      result = result.filter((r) => r.workflow === workflowFilter);
    }

    return [...result].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [runs, statusFilter, workflowFilter]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Workflow Runs</h1>
        <Badge variant="outline" className="gap-1.5">
          <Wifi className="h-3 w-3" />
          SSE Connected
        </Badge>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-2">
          {statusFilters.map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s)}
            >
              {statusLabels[s]}
            </Button>
          ))}
        </div>

        <Select
          value={workflowFilter}
          onValueChange={(v) => { if (v !== null) setWorkflowFilter(v); }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All workflows" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All workflows</SelectItem>
            {workflows.map((w) => (
              <SelectItem key={w} value={w}>
                {w}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No workflow runs found.
        </div>
      ) : (
        <RunTable runs={filtered} />
      )}
    </div>
  );
}
