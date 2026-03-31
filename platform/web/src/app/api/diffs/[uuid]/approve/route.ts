import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

function getWorkspaceDir(): string {
  return process.env.WORKSPACE_DIR || "/Users/arun/projects/devpod";
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params;

  try {
    const workspaceDir = getWorkspaceDir();
    const diffsDir = join(workspaceDir, ".devpod", "diffs");

    if (existsSync(diffsDir)) {
      const diffFiles = readdirSync(diffsDir).filter((f) =>
        f.endsWith(".json")
      );

      for (const file of diffFiles) {
        const filePath = join(diffsDir, file);
        const diffData = JSON.parse(readFileSync(filePath, "utf-8"));
        const diffUuid = diffData.uuid || file.replace(".json", "");

        if (diffUuid === uuid) {
          diffData.status = "approved";
          diffData.updated = new Date().toISOString();
          writeFileSync(filePath, JSON.stringify(diffData, null, 2));

          return NextResponse.json({
            success: true,
            uuid,
            status: "approved",
          });
        }
      }
    }

    // Mock mode: just return success
    return NextResponse.json({
      success: true,
      uuid,
      status: "approved",
      mock: true,
    });
  } catch (error) {
    console.error("Failed to approve diff:", error);
    return NextResponse.json(
      { error: "Failed to approve diff" },
      { status: 500 }
    );
  }
}
