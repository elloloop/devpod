import { NextResponse } from "next/server";
import {
  getRecentCommits,
  getCommitFiles,
  commitToPullRequest,
} from "@/lib/git";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const commits = getRecentCommits(20);

    const prs = commits.map((commit) => {
      const files = getCommitFiles(commit.sha);
      return commitToPullRequest(commit, files);
    });

    return NextResponse.json(prs);
  } catch (error) {
    console.error("Failed to fetch git data:", error);
    return NextResponse.json(
      { error: "Failed to read git data" },
      { status: 500 }
    );
  }
}
