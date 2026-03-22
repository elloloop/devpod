import { NextResponse } from "next/server";
import { getFileAtCommit } from "@/lib/git";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sha = url.searchParams.get("sha");
  const path = url.searchParams.get("path");

  if (!sha || !path) {
    return NextResponse.json(
      { error: "Missing sha or path query parameter" },
      { status: 400 }
    );
  }

  try {
    const content = getFileAtCommit(sha, path);
    if (content === null) {
      return NextResponse.json(
        { error: "File not found at this commit" },
        { status: 404 }
      );
    }

    return NextResponse.json({ content });
  } catch (error) {
    console.error("Failed to fetch file:", error);
    return NextResponse.json(
      { error: "Failed to read file" },
      { status: 500 }
    );
  }
}
