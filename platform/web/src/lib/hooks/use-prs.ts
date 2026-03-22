"use client";

import { useQuery } from "@tanstack/react-query";
import type { PullRequest } from "../types";
import { mockPullRequests } from "../mock-data";

async function fetchPRs(): Promise<PullRequest[]> {
  try {
    const res = await fetch("/api/prs");
    if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
  } catch {
    return mockPullRequests;
  }
}

async function fetchPR(id: number): Promise<PullRequest | null> {
  try {
    const res = await fetch(`/api/prs/${id}`);
    if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
  } catch {
    return mockPullRequests.find((pr) => pr.number === id) ?? null;
  }
}

export function usePullRequests() {
  return useQuery({
    queryKey: ["prs"],
    queryFn: fetchPRs,
  });
}

export function usePullRequest(id: number) {
  return useQuery({
    queryKey: ["prs", id],
    queryFn: () => fetchPR(id),
    enabled: !!id,
  });
}
