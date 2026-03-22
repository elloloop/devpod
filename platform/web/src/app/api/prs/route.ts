import { NextResponse } from "next/server";
import { mockPullRequests } from "@/lib/mock-data";

export async function GET() {
  // In production, this would proxy to GitHub API or read from local git
  return NextResponse.json(mockPullRequests);
}
