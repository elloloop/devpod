import type {
  WorkflowRun,
  Feature,
  PullRequest,
  Artifact,
  ActivityItem,
} from "./types";
import {
  mockWorkflowRuns,
  mockFeatures,
  mockPullRequests,
  mockArtifacts,
  mockActivity,
} from "./mock-data";

const RUNNER_URL =
  process.env.NEXT_PUBLIC_RUNNER_URL || "http://localhost:4800";

async function fetchWithFallback<T>(
  url: string,
  fallback: T
): Promise<T> {
  try {
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

// --- Features ---

export async function getFeatures(): Promise<Feature[]> {
  return fetchWithFallback<Feature[]>("/api/features", mockFeatures);
}

export async function getFeature(slug: string): Promise<Feature | null> {
  return fetchWithFallback<Feature | null>(
    `/api/features/${slug}`,
    mockFeatures.find((f) => f.slug === slug) ?? null
  );
}

// --- Pull Requests ---

export async function getPullRequests(): Promise<PullRequest[]> {
  return fetchWithFallback<PullRequest[]>("/api/prs", mockPullRequests);
}

export async function getPullRequest(
  id: number
): Promise<PullRequest | null> {
  return fetchWithFallback<PullRequest | null>(
    `/api/prs/${id}`,
    mockPullRequests.find((pr) => pr.number === id) ?? null
  );
}

// --- Workflow Runs ---

export async function getWorkflowRuns(): Promise<WorkflowRun[]> {
  return fetchWithFallback<WorkflowRun[]>(
    `${RUNNER_URL}/api/runs`,
    mockWorkflowRuns
  );
}

export async function getWorkflowRun(
  id: string
): Promise<WorkflowRun | null> {
  return fetchWithFallback<WorkflowRun | null>(
    `${RUNNER_URL}/api/runs/${id}`,
    mockWorkflowRuns.find((r) => r.id === id) ?? null
  );
}

export async function getRunArtifacts(runId: string): Promise<Artifact[]> {
  return fetchWithFallback<Artifact[]>(
    `${RUNNER_URL}/api/runs/${runId}/artifacts`,
    mockArtifacts[runId] ?? []
  );
}

// --- Activity ---

export async function getActivity(): Promise<ActivityItem[]> {
  return fetchWithFallback<ActivityItem[]>(
    `${RUNNER_URL}/api/activity`,
    mockActivity
  );
}

// --- SSE for real-time run updates ---

export function subscribeToEvents(
  onEvent: (event: { type: string; data: unknown }) => void
): () => void {
  let eventSource: EventSource | null = null;

  try {
    eventSource = new EventSource(`${RUNNER_URL}/api/events`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onEvent({ type: event.type || "message", data });
      } catch {
        // ignore parse errors
      }
    };

    eventSource.onerror = () => {
      // Reconnection is handled automatically by EventSource
    };
  } catch {
    // SSE not available
  }

  return () => {
    eventSource?.close();
  };
}
