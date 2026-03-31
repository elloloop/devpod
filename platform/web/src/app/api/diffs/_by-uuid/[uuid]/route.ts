import { NextResponse } from "next/server";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { mockStackedDiffs } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

function getWorkspaceDir(): string {
  return process.env.WORKSPACE_DIR || "/Users/arun/projects/devpod";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params;

  // Look up by UUID in .devpod/diffs/
  const diffsDir = join(getWorkspaceDir(), ".devpod", "diffs");
  if (existsSync(diffsDir)) {
    const files = readdirSync(diffsDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const data = JSON.parse(readFileSync(join(diffsDir, file), "utf-8"));
      if ((data.uuid || file.replace(".json", "")) === uuid) {
        return NextResponse.json({
          ...data,
          diff: "",
          detailedFiles: data.files || [],
        });
      }
    }
  }

  // Fallback to mock
  for (const feature of mockStackedDiffs) {
    const diff = feature.diffs.find((d) => d.uuid === uuid);
    if (diff) {
      return NextResponse.json({ ...diff, diff: "", detailedFiles: diff.files });
    }
  }

  return NextResponse.json({ error: "Diff not found" }, { status: 404 });
}
