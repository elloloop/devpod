import type {
  WorkflowRun,
  Feature,
  PullRequest,
  Artifact,
  FeatureWithDiffs,
  DiffDetail,
  DiffVersionInfo,
  CompareResult,
} from './types';

const RUNNER_URL =
  typeof window === 'undefined'
    ? process.env.NEXT_PUBLIC_RUNNER_URL || 'http://localhost:4800'
    : process.env.NEXT_PUBLIC_RUNNER_URL || 'http://localhost:4800';

// --- Diffs ---

export async function fetchFeaturesDiffs(): Promise<FeatureWithDiffs[]> {
  const res = await fetch('/api/diffs');
  if (!res.ok) throw new Error('Failed to fetch diffs');
  return res.json();
}

export async function fetchDiffBySlugPosition(
  slug: string,
  position: number
): Promise<DiffDetail | null> {
  const res = await fetch(`/api/diffs/${slug}/${position}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error('Failed to fetch diff');
  }
  return res.json();
}

export async function fetchDiffByUuid(uuid: string): Promise<DiffDetail | null> {
  const res = await fetch(`/api/diffs/_by-uuid/${uuid}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error('Failed to fetch diff');
  }
  return res.json();
}

export async function approveDiff(slug: string, position: number): Promise<void> {
  await fetch(`/api/diffs/${slug}/${position}/approve`, { method: 'POST' });
}

export async function rejectDiff(slug: string, position: number, comment?: string): Promise<void> {
  await fetch(`/api/diffs/${slug}/${position}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment: comment || '' }),
  });
}

// --- Versions ---

export async function fetchDiffVersions(
  slug: string,
  position: number
): Promise<DiffVersionInfo[]> {
  const res = await fetch(`/api/diffs/${slug}/${position}/versions`);
  if (!res.ok) throw new Error('Failed to fetch versions');
  return res.json();
}

export async function fetchCompare(
  left: string,
  right: string,
  files?: string[]
): Promise<CompareResult> {
  const res = await fetch('/api/diffs/compare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ left, right, files }),
  });
  if (!res.ok) throw new Error('Failed to compare snapshots');
  return res.json();
}

// --- PRs ---

export async function fetchPRs(): Promise<PullRequest[]> {
  const res = await fetch('/api/prs');
  if (!res.ok) throw new Error('Failed to fetch PRs');
  return res.json();
}

export async function fetchPR(id: string): Promise<PullRequest | null> {
  const res = await fetch(`/api/prs/${id}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error('Failed to fetch PR');
  }
  return res.json();
}

// --- Features ---

export async function fetchFeatures(): Promise<Feature[]> {
  const res = await fetch('/api/features');
  if (!res.ok) throw new Error('Failed to fetch features');
  return res.json();
}

export async function fetchFeature(slug: string): Promise<Feature | null> {
  const res = await fetch(`/api/features/${slug}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error('Failed to fetch feature');
  }
  return res.json();
}

// --- Runs ---

export async function fetchRuns(): Promise<WorkflowRun[]> {
  try {
    const res = await fetch(`${RUNNER_URL}/api/runs`);
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
  } catch {
    return [];
  }
}

export async function fetchRun(id: string): Promise<WorkflowRun | null> {
  try {
    const res = await fetch(`${RUNNER_URL}/api/runs/${id}`);
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchArtifacts(runId: string): Promise<Artifact[]> {
  try {
    const res = await fetch(`${RUNNER_URL}/api/runs/${runId}/artifacts`);
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
  } catch {
    return [];
  }
}
