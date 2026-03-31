import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { isGeneratedFile } from "@/lib/generated-files";
import type { DiffFile } from "@/lib/types";
import { mockStackedDiffs } from "@/lib/mock-data";

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

function splitDiffByFile(diff: string): Map<string, string> {
  const result = new Map<string, string>();
  const lines = diff.split("\n");
  let currentPath = "";
  let currentLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("diff --git")) {
      if (currentPath && currentLines.length > 0) {
        result.set(currentPath, currentLines.join("\n"));
      }
      currentLines = [line];
      currentPath = "";
    } else if (line.startsWith("+++ b/") && !currentPath) {
      currentPath = line.replace("+++ b/", "");
      currentLines.push(line);
    } else if (line.startsWith("+++ /dev/null") && !currentPath) {
      const prevLine = currentLines.find((l) => l.startsWith("--- a/"));
      if (prevLine) {
        currentPath = prevLine.replace("--- a/", "");
      }
      currentLines.push(line);
    } else {
      currentLines.push(line);
    }
  }

  if (currentPath && currentLines.length > 0) {
    result.set(currentPath, currentLines.join("\n"));
  }

  return result;
}

function getDetailedFilesForCommit(sha: string): DiffFile[] {
  const numstat = git(`diff-tree --no-commit-id -r --numstat ${sha}`);
  if (!numstat) return [];

  const diffOutput = git(`diff ${sha}~1..${sha}`);
  const fileDiffs = diffOutput ? splitDiffByFile(diffOutput) : new Map<string, string>();

  const results: DiffFile[] = [];

  for (const line of numstat.split("\n").filter(Boolean)) {
    const parts = line.split("\t");
    if (parts.length < 3) continue;

    const additions = parts[0] === "-" ? 0 : parseInt(parts[0], 10);
    const deletions = parts[1] === "-" ? 0 : parseInt(parts[1], 10);
    const filePath = parts[2];

    let status: DiffFile["status"] = "modified";
    if (additions > 0 && deletions === 0) status = "added";
    else if (additions === 0 && deletions > 0) status = "deleted";

    results.push({
      path: filePath,
      status,
      additions,
      deletions,
      isGenerated: isGeneratedFile(filePath),
      diff: fileDiffs.get(filePath) || "",
    });
  }

  return results;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params;

  try {
    // Try reading from .devpod/ directory first
    const workspaceDir = getWorkspaceDir();
    const diffsDir = join(workspaceDir, ".devpod", "diffs");

    if (existsSync(diffsDir)) {
      const diffFiles = readdirSync(diffsDir).filter((f) =>
        f.endsWith(".json")
      );

      for (const file of diffFiles) {
        const diffData = JSON.parse(
          readFileSync(join(diffsDir, file), "utf-8")
        );
        const diffUuid = diffData.uuid || file.replace(".json", "");

        if (diffUuid === uuid) {
          const fullDiff = diffData.commit
            ? git(`show ${diffData.commit}`)
            : "";
          const detailedFiles = diffData.commit
            ? getDetailedFilesForCommit(diffData.commit)
            : [];

          return NextResponse.json({
            uuid: diffUuid,
            position: diffData.position || 1,
            title: diffData.title || "",
            description: diffData.description || "",
            type: diffData.type || "feature",
            status: diffData.status || "draft",
            ci: diffData.ci || null,
            commit: diffData.commit || "",
            files: detailedFiles.map((f) => ({
              path: f.path,
              status: f.status,
              additions: f.additions,
              deletions: f.deletions,
            })),
            additions: detailedFiles.reduce((s, f) => s + f.additions, 0),
            deletions: detailedFiles.reduce((s, f) => s + f.deletions, 0),
            version: diffData.version || 1,
            created: diffData.created || "",
            updated: diffData.updated || "",
            diff: fullDiff,
            detailedFiles,
          });
        }
      }
    }

    // Fall back to mock data
    for (const feature of mockStackedDiffs) {
      const diff = feature.diffs.find((d) => d.uuid === uuid);
      if (diff) {
        return NextResponse.json({
          ...diff,
          diff: diff.files
            .map((f) => f.diff)
            .filter(Boolean)
            .join("\n"),
          detailedFiles: diff.files,
        });
      }
    }

    return NextResponse.json({ error: "Diff not found" }, { status: 404 });
  } catch (error) {
    console.error("Failed to fetch diff:", error);
    return NextResponse.json(
      { error: "Failed to read diff data" },
      { status: 500 }
    );
  }
}
