"use client";

import { useQuery } from "@tanstack/react-query";
import type { PullRequest } from "../types";

async function fetchPRs(): Promise<PullRequest[]> {
  const res = await fetch("/api/prs");
  if (!res.ok) throw new Error("Failed to fetch PRs");
  return res.json();
}

async function fetchPR(id: string): Promise<PullRequest | null> {
  const res = await fetch(`/api/prs/${id}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error("Failed to fetch PR");
  }
  return res.json();
}

export function usePullRequests() {
  return useQuery({
    queryKey: ["prs"],
    queryFn: fetchPRs,
  });
}

export function usePullRequest(id: string) {
  return useQuery({
    queryKey: ["prs", id],
    queryFn: () => fetchPR(id),
    enabled: !!id,
  });
}
