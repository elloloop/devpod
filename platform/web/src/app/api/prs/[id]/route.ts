import { NextResponse } from "next/server";
import {
  getCommitDetail,
  getCommitFiles,
  commitToPullRequest,
} from "@/lib/git";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const commit = getCommitDetail(id);
    if (!commit) {
      return NextResponse.json(
        { error: "Commit not found" },
        { status: 404 }
      );
    }

    const files = getCommitFiles(commit.sha);
    const pr = commitToPullRequest(commit, files);

    return NextResponse.json(pr);
  } catch (error) {
    console.error("Failed to fetch commit:", error);
    return NextResponse.json(
      { error: "Failed to read commit data" },
      { status: 500 }
    );
  }
}
