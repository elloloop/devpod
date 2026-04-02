import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { isGeneratedFile } from "@/lib/generated-files";
import type { DiffFile, CompareRequest } from "@/lib/types";

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
      if (prevLine) currentPath = prevLine.replace("--- a/", "");
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

function isSha(s: string): boolean {
  return /^[a-f0-9]{6,40}$/i.test(s);
}

export async function POST(request: Request) {
  try {
    const body: CompareRequest = await request.json();
    const { left, right, files: fileFilter } = body;

    if (!left || !right) {
      return NextResponse.json(
        { error: "left and right SHAs are required" },
        { status: 400 }
      );
    }

    // Validate SHAs look safe
    if (!isSha(left) || !isSha(right)) {
      return NextResponse.json(
        { error: "Invalid SHA format" },
        { status: 400 }
      );
    }

    // Get the diff between the two commits
    let diffCmd = `diff ${left}..${right}`;
    if (fileFilter && fileFilter.length > 0) {
      diffCmd += ` -- ${fileFilter.map((f) => `'${f}'`).join(" ")}`;
    }
    const diffOutput = git(diffCmd);

    // Get numstat
    let numstatCmd = `diff --numstat ${left}..${right}`;
    if (fileFilter && fileFilter.length > 0) {
      numstatCmd += ` -- ${fileFilter.map((f) => `'${f}'`).join(" ")}`;
    }
    const numstat = git(numstatCmd);

    // Parse file diffs
    const fileDiffs = diffOutput ? splitDiffByFile(diffOutput) : new Map<string, string>();

    const resultFiles: DiffFile[] = [];
    if (numstat) {
      for (const line of numstat.split("\n").filter(Boolean)) {
        const parts = line.split("\t");
        if (parts.length < 3) continue;
        const additions = parts[0] === "-" ? 0 : parseInt(parts[0], 10);
        const deletions = parts[1] === "-" ? 0 : parseInt(parts[1], 10);
        const filePath = parts[2];
        let status: DiffFile["status"] = "modified";
        if (additions > 0 && deletions === 0) status = "added";
        else if (additions === 0 && deletions > 0) status = "deleted";
        resultFiles.push({
          path: filePath,
          status,
          additions,
          deletions,
          isGenerated: isGeneratedFile(filePath),
          diff: fileDiffs.get(filePath) || "",
        });
      }
    }

    // Generate labels from short SHAs
    const leftShort = left.substring(0, 7);
    const rightShort = right.substring(0, 7);

    return NextResponse.json({
      diff: diffOutput,
      files: resultFiles,
      leftLabel: leftShort,
      rightLabel: rightShort,
    });
  } catch (error) {
    console.error("Failed to compare:", error);
    return NextResponse.json(
      { error: "Failed to compare snapshots" },
      { status: 500 }
    );
  }
}
