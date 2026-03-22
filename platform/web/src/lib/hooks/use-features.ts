"use client";

import { useQuery } from "@tanstack/react-query";
import type { Feature } from "../types";
import { mockFeatures } from "../mock-data";

async function fetchFeatures(): Promise<Feature[]> {
  try {
    const res = await fetch("/api/features");
    if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
  } catch {
    return mockFeatures;
  }
}

async function fetchFeature(slug: string): Promise<Feature | null> {
  try {
    const res = await fetch(`/api/features/${slug}`);
    if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
  } catch {
    return mockFeatures.find((f) => f.slug === slug) ?? null;
  }
}

export function useFeatures() {
  return useQuery({
    queryKey: ["features"],
    queryFn: fetchFeatures,
  });
}

export function useFeature(slug: string) {
  return useQuery({
    queryKey: ["features", slug],
    queryFn: () => fetchFeature(slug),
    enabled: !!slug,
  });
}
