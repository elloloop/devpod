"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { StatusBadge } from "@/components/shared/status-badge";
import { StepLog } from "./step-log";
import { ChevronDown } from "lucide-react";
import { differenceInSeconds, parseISO } from "date-fns";
import type { Job } from "@/lib/types";

interface JobListProps {
  jobs: Job[];
}

function formatDuration(start?: string, end?: string): string {
  if (!start) return "-";
  if (!end) return "Running...";
  const seconds = differenceInSeconds(parseISO(end), parseISO(start));
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

export function JobList({ jobs }: JobListProps) {
  return (
    <div className="space-y-4">
      {jobs.map((job) => (
        <Collapsible key={job.id} defaultOpen>
          <div className="rounded-lg border">
            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-accent/50 transition-colors group">
              <div className="flex items-center gap-3">
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                <StatusBadge status={job.conclusion || job.status} />
                <span className="font-medium">{job.name}</span>
              </div>
              <span className="text-sm text-muted-foreground font-mono">
                {formatDuration(job.startedAt, job.completedAt)}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t divide-y">
                {job.steps.map((step, i) => (
                  <Collapsible key={i}>
                    <CollapsibleTrigger className="flex items-center gap-3 w-full text-left px-6 py-2.5 hover:bg-accent/30 transition-colors group">
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                      <StatusBadge
                        status={step.conclusion || step.status}
                      />
                      <span className="text-sm">{step.name}</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-6 pb-3">
                        <StepLog log={step.log} />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      ))}
    </div>
  );
}
