"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { StatusBadge } from "@/components/shared/status-badge";
import { DateDisplay } from "@/components/shared/date-display";
import { ChevronDown } from "lucide-react";
import type { WorkflowRun } from "@/lib/types";

interface ChecksPanelProps {
  checks: WorkflowRun[];
}

export function ChecksPanel({ checks }: ChecksPanelProps) {
  if (checks.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        No workflow runs associated with this PR.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {checks.map((run) => (
        <div key={run.id} className="rounded-lg border">
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
              <StatusBadge status={run.conclusion || run.status} />
              <span className="font-medium">{run.workflow}</span>
            </div>
            <DateDisplay
              date={run.createdAt}
              className="text-sm text-muted-foreground"
            />
          </div>
          <div className="divide-y">
            {run.jobs.map((job) => (
              <div key={job.id} className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <StatusBadge status={job.conclusion || job.status} />
                  <span className="text-sm font-medium">{job.name}</span>
                </div>
                <div className="space-y-1 ml-2">
                  {job.steps.map((step, i) => (
                    <Collapsible key={i}>
                      <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-1.5 px-2 rounded hover:bg-accent/50 transition-colors group">
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                        <StatusBadge
                          status={step.conclusion || step.status}
                        />
                        <span className="text-sm">{step.name}</span>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        {step.log && (
                          <pre className="mt-1 ml-6 rounded-md bg-zinc-950 p-3 text-xs text-zinc-300 font-mono overflow-x-auto whitespace-pre-wrap">
                            {step.log}
                          </pre>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
