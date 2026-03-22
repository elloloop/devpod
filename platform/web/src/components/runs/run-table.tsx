"use client";

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { DateDisplay } from "@/components/shared/date-display";
import { differenceInSeconds, parseISO } from "date-fns";
import type { WorkflowRun } from "@/lib/types";

interface RunTableProps {
  runs: WorkflowRun[];
}

function formatDuration(start: string, end: string): string {
  const seconds = differenceInSeconds(parseISO(end), parseISO(start));
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

export function RunTable({ runs }: RunTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Workflow</TableHead>
            <TableHead className="w-28">Status</TableHead>
            <TableHead className="w-32">Trigger</TableHead>
            <TableHead className="w-24">Duration</TableHead>
            <TableHead className="w-36">Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => {
            const duration =
              run.status === "completed" && run.createdAt && run.updatedAt
                ? formatDuration(run.createdAt, run.updatedAt)
                : run.status === "in_progress"
                  ? "Running..."
                  : "-";

            return (
              <TableRow key={run.id} className="cursor-pointer hover:bg-accent/50">
                <TableCell>
                  <Link
                    href={`/runs/${run.id}`}
                    className="font-medium hover:underline"
                  >
                    {run.workflow}
                  </Link>
                </TableCell>
                <TableCell>
                  <StatusBadge status={run.conclusion || run.status} />
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <span className="text-muted-foreground">
                      {run.trigger.event}
                    </span>
                    <div className="font-mono text-xs text-muted-foreground/60 truncate max-w-[120px]">
                      {run.trigger.ref.replace("refs/heads/", "")}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground font-mono">
                  {duration}
                </TableCell>
                <TableCell>
                  <DateDisplay
                    date={run.createdAt}
                    className="text-sm text-muted-foreground"
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
