import { NextResponse } from "next/server";
import { mockPullRequests } from "@/lib/mock-data";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pr = mockPullRequests.find((p) => p.number === parseInt(id, 10));

  if (!pr) {
    return NextResponse.json(
      { error: "Pull request not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(pr);
}
