"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { FeatureWithDiffs, DiffDetail } from "../types";

async function fetchFeaturesDiffs(): Promise<FeatureWithDiffs[]> {
  const res = await fetch("/api/diffs");
  if (!res.ok) throw new Error("Failed to fetch diffs");
  return res.json();
}

async function fetchDiffDetail(uuid: string): Promise<DiffDetail | null> {
  const res = await fetch(`/api/diffs/${uuid}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error("Failed to fetch diff");
  }
  return res.json();
}

async function approveDiff(uuid: string): Promise<void> {
  const res = await fetch(`/api/diffs/${uuid}/approve`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to approve diff");
}

async function rejectDiff(uuid: string, comment: string): Promise<void> {
  const res = await fetch(`/api/diffs/${uuid}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ comment }),
  });
  if (!res.ok) throw new Error("Failed to request changes");
}

export function useFeaturesDiffs() {
  return useQuery({
    queryKey: ["diffs"],
    queryFn: fetchFeaturesDiffs,
  });
}

export function useDiffDetail(uuid: string) {
  return useQuery({
    queryKey: ["diffs", uuid],
    queryFn: () => fetchDiffDetail(uuid),
    enabled: !!uuid,
  });
}

export function useApproveDiff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: approveDiff,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diffs"] });
    },
  });
}

export function useRejectDiff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      uuid,
      comment,
    }: {
      uuid: string;
      comment: string;
    }) => rejectDiff(uuid, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diffs"] });
    },
  });
}
