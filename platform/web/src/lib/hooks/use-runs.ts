"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import type { WorkflowRun, Artifact } from "../types";
import { mockWorkflowRuns, mockArtifacts } from "../mock-data";

const RUNNER_URL =
  process.env.NEXT_PUBLIC_RUNNER_URL || "http://localhost:4800";

async function fetchRuns(): Promise<WorkflowRun[]> {
  try {
    const res = await fetch(`${RUNNER_URL}/api/runs`);
    if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
  } catch {
    return mockWorkflowRuns;
  }
}

async function fetchRun(id: string): Promise<WorkflowRun | null> {
  try {
    const res = await fetch(`${RUNNER_URL}/api/runs/${id}`);
    if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
  } catch {
    return mockWorkflowRuns.find((r) => r.id === id) ?? null;
  }
}

async function fetchArtifacts(runId: string): Promise<Artifact[]> {
  try {
    const res = await fetch(`${RUNNER_URL}/api/runs/${runId}/artifacts`);
    if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
  } catch {
    return mockArtifacts[runId] ?? [];
  }
}

export function useWorkflowRuns() {
  return useQuery({
    queryKey: ["runs"],
    queryFn: fetchRuns,
    refetchInterval: 10000,
  });
}

export function useWorkflowRun(id: string) {
  const query = useQuery({
    queryKey: ["runs", id],
    queryFn: () => fetchRun(id),
    enabled: !!id,
    refetchInterval: (query) => {
      const run = query.state.data;
      if (run && (run.status === "in_progress" || run.status === "queued")) {
        return 3000;
      }
      return false;
    },
  });

  return query;
}

export function useRunArtifacts(runId: string) {
  return useQuery({
    queryKey: ["runs", runId, "artifacts"],
    queryFn: () => fetchArtifacts(runId),
    enabled: !!runId,
  });
}

export function useRunEvents(onEvent: (data: unknown) => void) {
  useEffect(() => {
    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource(`${RUNNER_URL}/api/events`);
      eventSource.onmessage = (event) => {
        try {
          onEvent(JSON.parse(event.data));
        } catch {
          // ignore
        }
      };
    } catch {
      // SSE not available
    }

    return () => {
      eventSource?.close();
    };
  }, [onEvent]);
}
