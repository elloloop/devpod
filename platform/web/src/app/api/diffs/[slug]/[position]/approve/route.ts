import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

function getWorkspaceDir(): string {
  return process.env.WORKSPACE_DIR || "/Users/arun/projects/devpod";
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string; position: string }> }
) {
  const { slug, position } = await params;
  const posNum = parseInt(position, 10);

  const diffsDir = join(getWorkspaceDir(), ".devpod", "diffs");
  if (!existsSync(diffsDir)) {
    return NextResponse.json({ message: "Approved (mock)" });
  }

  const files = readdirSync(diffsDir).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    const filePath = join(diffsDir, file);
    const data = JSON.parse(readFileSync(filePath, "utf-8"));
    if (data.feature === slug && data.position === posNum) {
      data.status = "approved";
      data.updated = new Date().toISOString();
      writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
      return NextResponse.json({ message: `D${position} approved` });
    }
  }

  return NextResponse.json({ message: "Approved (mock)" });
}
