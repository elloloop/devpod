import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { mockVersionHistories } from "@/lib/mock-data";
import type { DiffVersionInfo } from "@/lib/types";

export const dynamic = "force-dynamic";

function getWorkspaceDir(): string {
  return process.env.WORKSPACE_DIR || "/Users/arun/projects/devpod";
}

function git(command: string): string {
  try {
    return execSync(`git ${command}`, {
      cwd: getWorkspaceDir(),
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    }).trim();
  } catch {
    return "";
  }
}

function branchExists(branch: string): boolean {
  const result = git(`rev-parse --verify ${branch}`);
  return result.length > 0;
}

function parseVersionsFromBranch(
  versionsBranch: string,
  position: number
): DiffVersionInfo[] {
  const diffLabel = `D${position}`;
  const log = git(
    `log ${versionsBranch} --format=%H|%s|%b|%ci --reverse`
  );
  if (!log) return [];

  const versions: DiffVersionInfo[] = [];

  for (const entry of log.split("\n").filter(Boolean)) {
    const pipeIdx1 = entry.indexOf("|");
    const pipeIdx2 = entry.indexOf("|", pipeIdx1 + 1);
    const pipeIdx3 = entry.indexOf("|", pipeIdx2 + 1);

    if (pipeIdx1 < 0 || pipeIdx2 < 0 || pipeIdx3 < 0) continue;

    const sha = entry.substring(0, pipeIdx1);
    const subject = entry.substring(pipeIdx1 + 1, pipeIdx2);
    const body = entry.substring(pipeIdx2 + 1, pipeIdx3);
    const dateStr = entry.substring(pipeIdx3 + 1);

    // Parse trailers from body
    const trailers: Record<string, string> = {};
    for (const line of body.split("\n")) {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const key = line.substring(0, colonIdx).trim();
        const val = line.substring(colonIdx + 1).trim();
        trailers[key] = val;
      }
    }

    // Filter: only include if Diff trailer matches
    if (trailers["Diff"] && trailers["Diff"] !== diffLabel) continue;

    versions.push({
      snapshotId: trailers["Snapshot"] || `S${versions.length + 1}`,
      snapshotSha: sha,
      version: trailers["Version"]
        ? parseInt(trailers["Version"], 10)
        : versions.length + 1,
      action: trailers["Action"] || "update",
      message: subject,
      date: dateStr.trim(),
      stack: trailers["Stack"] || "",
    });
  }

  return versions;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; position: string }> }
) {
  const { slug, position } = await params;
  const posNum = parseInt(position, 10);

  try {
    // Try reading from the versions branch
    const versionsBranch = `feature/${slug}--versions`;
    if (branchExists(versionsBranch)) {
      const versions = parseVersionsFromBranch(versionsBranch, posNum);
      if (versions.length > 0) {
        return NextResponse.json(versions);
      }
    }

    // Fall back to mock data
    const key = `${slug}/${posNum}`;
    const mock = mockVersionHistories[key];
    if (mock) {
      return NextResponse.json(mock);
    }

    // Return empty if nothing found
    return NextResponse.json([]);
  } catch (error) {
    console.error("Failed to fetch versions:", error);
    return NextResponse.json(
      { error: "Failed to read version data" },
      { status: 500 }
    );
  }
}
