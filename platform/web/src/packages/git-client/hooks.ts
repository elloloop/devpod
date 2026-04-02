"use client";

import { useQuery } from '@tanstack/react-query';
import {
  fetchFeaturesDiffs,
  fetchDiffBySlugPosition,
  fetchDiffByUuid,
  fetchDiffVersions,
  fetchCompare,
  fetchPRs,
  fetchPR,
  fetchFeatures,
  fetchFeature,
  fetchRuns,
  fetchRun,
  fetchArtifacts,
} from './api';
import {
  mockWorkflowRuns,
  mockFeatures,
  mockArtifacts,
} from '@/lib/mock-data';
import type {
  FeatureWithDiffs,
  DiffDetail,
  DiffVersionInfo,
  CompareResult,
  PullRequest,
  Feature,
  WorkflowRun,
  Artifact,
} from './types';

// --- Diffs ---

export function useFeaturesDiffs() {
  return useQuery<FeatureWithDiffs[]>({
    queryKey: ['diffs'],
    queryFn: fetchFeaturesDiffs,
  });
}

export function useDiffBySlugPosition(slug: string, position: number) {
  return useQuery<DiffDetail | null>({
    queryKey: ['diffs', slug, position],
    queryFn: () => fetchDiffBySlugPosition(slug, position),
    enabled: !!slug && position > 0,
  });
}

export function useDiffDetail(uuid: string) {
  return useQuery<DiffDetail | null>({
    queryKey: ['diffs', 'uuid', uuid],
    queryFn: () => fetchDiffByUuid(uuid),
    enabled: !!uuid,
  });
}

// --- Versions ---

export function useDiffVersions(slug: string, position: number) {
  return useQuery<DiffVersionInfo[]>({
    queryKey: ['diffs', slug, position, 'versions'],
    queryFn: () => fetchDiffVersions(slug, position),
    enabled: !!slug && position > 0,
  });
}

export function useCompare(left: string, right: string, files?: string[]) {
  return useQuery<CompareResult>({
    queryKey: ['compare', left, right, files],
    queryFn: () => fetchCompare(left, right, files),
    enabled: !!left && !!right && left !== right,
  });
}

// --- PRs ---

export function usePullRequests() {
  return useQuery<PullRequest[]>({
    queryKey: ['prs'],
    queryFn: fetchPRs,
  });
}

export function usePullRequest(id: string) {
  return useQuery<PullRequest | null>({
    queryKey: ['prs', id],
    queryFn: () => fetchPR(id),
    enabled: !!id,
  });
}

// --- Features ---

export function useFeatures() {
  return useQuery<Feature[]>({
    queryKey: ['features'],
    queryFn: async () => {
      try {
        return await fetchFeatures();
      } catch {
        return mockFeatures;
      }
    },
  });
}

export function useFeature(slug: string) {
  return useQuery<Feature | null>({
    queryKey: ['features', slug],
    queryFn: async () => {
      try {
        return await fetchFeature(slug);
      } catch {
        return mockFeatures.find((f) => f.slug === slug) ?? null;
      }
    },
    enabled: !!slug,
  });
}

// --- Runs ---

export function useWorkflowRuns() {
  return useQuery<WorkflowRun[]>({
    queryKey: ['runs'],
    queryFn: async () => {
      try {
        return await fetchRuns();
      } catch {
        return mockWorkflowRuns;
      }
    },
    refetchInterval: 10000,
  });
}

export function useWorkflowRun(id: string) {
  return useQuery<WorkflowRun | null>({
    queryKey: ['runs', id],
    queryFn: async () => {
      try {
        return await fetchRun(id);
      } catch {
        return mockWorkflowRuns.find((r) => r.id === id) ?? null;
      }
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const run = query.state.data;
      if (run && (run.status === 'in_progress' || run.status === 'queued')) {
        return 3000;
      }
      return false;
    },
  });
}

export function useRunArtifacts(runId: string) {
  return useQuery<Artifact[]>({
    queryKey: ['runs', runId, 'artifacts'],
    queryFn: async () => {
      try {
        return await fetchArtifacts(runId);
      } catch {
        return mockArtifacts[runId] ?? [];
      }
    },
    enabled: !!runId,
  });
}
