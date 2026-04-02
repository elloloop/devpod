import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { isGeneratedFile } from "@/lib/generated-files";
import type { FeatureWithDiffs, StackedDiff, DiffFile } from "@/lib/types";
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

function getCurrentBranch(): string {
  return git("rev-parse --abbrev-ref HEAD");
}

function parseFilesFromDiff(sha: string): DiffFile[] {
  const numstat = git(`diff-tree --no-commit-id -r --numstat ${sha}`);
  if (!numstat) return [];

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
      diff: "",
    });
  }

  return results;
}

function readDevpodData(): FeatureWithDiffs[] | null {
  const workspaceDir = getWorkspaceDir();
  const devpodDir = join(workspaceDir, ".devpod");

  if (!existsSync(devpodDir)) return null;

  const featuresDir = join(devpodDir, "features");
  const diffsDir = join(devpodDir, "diffs");

  if (!existsSync(featuresDir) || !existsSync(diffsDir)) return null;

  const currentBranch = getCurrentBranch();
  const result: FeatureWithDiffs[] = [];

  try {
    const featureFiles = readdirSync(featuresDir).filter((f) =>
      f.endsWith(".json")
    );

    for (const file of featureFiles) {
      const featureData = JSON.parse(
        readFileSync(join(featuresDir, file), "utf-8")
      );

      // Find diffs for this feature
      const allDiffFiles = readdirSync(diffsDir).filter((f) =>
        f.endsWith(".json")
      );
      const featureDiffs: StackedDiff[] = [];

      for (const diffFile of allDiffFiles) {
        const diffData = JSON.parse(
          readFileSync(join(diffsDir, diffFile), "utf-8")
        );

        if ((diffData.feature || diffData.featureSlug) === featureData.slug) {
          const files = diffData.commit
            ? parseFilesFromDiff(diffData.commit)
            : [];
          const additions = files.reduce((sum, f) => sum + f.additions, 0);
          const deletions = files.reduce((sum, f) => sum + f.deletions, 0);

          featureDiffs.push({
            uuid: diffData.uuid || diffFile.replace(".json", ""),
            position: diffData.position || 1,
            title: diffData.title || "",
            description: diffData.description || "",
            type: diffData.type || featureData.type || "feature",
            status: diffData.status || "draft",
            ci: diffData.ci || null,
            commit: diffData.commit || "",
            files,
            additions: diffData.additions ?? additions,
            deletions: diffData.deletions ?? deletions,
            version: diffData.version || 1,
            created: diffData.created || "",
            updated: diffData.updated || "",
          });
        }
      }

      featureDiffs.sort((a, b) => a.position - b.position);

      result.push({
        feature: {
          name: featureData.name || featureData.slug || "",
          type: featureData.type || "feature",
          slug: featureData.slug || "",
          branch: featureData.branch || "",
          created: featureData.created || "",
          status: featureData.status || "active",
        },
        diffs: featureDiffs,
        isCurrent: featureData.branch === currentBranch,
      });
    }

    return result.length > 0 ? result : null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const devpodData = readDevpodData();

    if (devpodData) {
      return NextResponse.json(devpodData);
    }

    // Fall back to mock data
    return NextResponse.json(mockStackedDiffs);
  } catch (error) {
    console.error("Failed to fetch diffs data:", error);
    return NextResponse.json(
      { error: "Failed to read diffs data" },
      { status: 500 }
    );
  }
}
