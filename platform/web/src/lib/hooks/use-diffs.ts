"use client";

import { useQuery } from "@tanstack/react-query";
import type { FeatureWithDiffs, DiffDetail } from "../types";

async function fetchFeaturesDiffs(): Promise<FeatureWithDiffs[]> {
  const res = await fetch("/api/diffs");
  if (!res.ok) throw new Error("Failed to fetch diffs");
  return res.json();
}

async function fetchDiffBySlugPosition(
  slug: string,
  position: number
): Promise<DiffDetail | null> {
  const res = await fetch(`/api/diffs/${slug}/${position}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error("Failed to fetch diff");
  }
  return res.json();
}

async function fetchDiffByUuid(uuid: string): Promise<DiffDetail | null> {
  const res = await fetch(`/api/diffs/_by-uuid/${uuid}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error("Failed to fetch diff");
  }
  return res.json();
}

export function useFeaturesDiffs() {
  return useQuery({
    queryKey: ["diffs"],
    queryFn: fetchFeaturesDiffs,
  });
}

export function useDiffDetail(uuid: string) {
  return useQuery({
    queryKey: ["diffs", "uuid", uuid],
    queryFn: () => fetchDiffByUuid(uuid),
    enabled: !!uuid,
  });
}

export function useDiffBySlugPosition(slug: string, position: number) {
  return useQuery({
    queryKey: ["diffs", slug, position],
    queryFn: () => fetchDiffBySlugPosition(slug, position),
    enabled: !!slug && position > 0,
  });
}
