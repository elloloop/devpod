import { execSync } from "child_process";
import { isGeneratedFile } from "./generated-files";
import type { DiffFile, PullRequest } from "./types";

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

export interface CommitInfo {
  sha: string;
  shortSha: string;
  title: string;
  body: string;
  author: string;
  date: string;
  parentSha: string;
}

const SEP = "<>";

export function getRecentCommits(count: number = 20): CommitInfo[] {
  const raw = git(
    `log --format='%H${SEP}%s${SEP}%an${SEP}%ai${SEP}%P' -${count} main`
  );
  if (!raw) return [];

  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(SEP);
      const sha = parts[0] || "";
      const title = parts[1] || "";
      const author = parts[2] || "";
      const date = parts[3] || "";
      const parents = parts[4] || "";
      const parentSha = parents.split(" ")[0] || "";

      return {
        sha,
        shortSha: sha.substring(0, 7),
        title,
        body: "",
        author,
        date,
        parentSha,
      };
    });
}

export function getCommitDetail(sha: string): CommitInfo | null {
  if (!/^[a-f0-9]{4,40}$/i.test(sha)) return null;

  const headerRaw = git(
    `log -1 --format='%H${SEP}%s${SEP}%an${SEP}%ai${SEP}%P' ${sha}`
  );
  if (!headerRaw) return null;

  const parts = headerRaw.split(SEP);
  if (parts.length < 5) return null;

  const commitSha = parts[0] || "";
  const title = parts[1] || "";
  const author = parts[2] || "";
  const date = parts[3] || "";
  const parents = parts[4] || "";
  const parentSha = parents.split(" ")[0] || "";

  // Get body separately to avoid delimiter issues
  const body = git(`log -1 --format='%b' ${sha}`);

  return {
    sha: commitSha,
    shortSha: commitSha.substring(0, 7),
    title,
    body: body.trim(),
    author,
    date,
    parentSha,
  };
}

export function getCommitFiles(sha: string): DiffFile[] {
  if (!/^[a-f0-9]{4,40}$/i.test(sha)) return [];

  const numstat = git(`diff-tree --no-commit-id -r --numstat ${sha}`);
  if (!numstat) return [];

  const diffOutput = git(`diff ${sha}~1..${sha}`);

  // Parse numstat for file info
  const fileMap = new Map<string, DiffFile>();
  for (const line of numstat.split("\n").filter(Boolean)) {
    const parts = line.split("\t");
    if (parts.length < 3) continue;

    const additions = parts[0] === "-" ? 0 : parseInt(parts[0], 10);
    const deletions = parts[1] === "-" ? 0 : parseInt(parts[1], 10);
    const filePath = parts[2];

    // Detect renames: {old => new} or old => new
    let status: DiffFile["status"] = "modified";
    let actualPath = filePath;
    let oldPath: string | undefined;

    if (filePath.includes(" => ")) {
      status = "renamed";
      const renameMatch = filePath.match(/\{(.+?) => (.+?)\}/);
      if (renameMatch) {
        const prefix = filePath.substring(0, filePath.indexOf("{"));
        const suffix = filePath.substring(filePath.indexOf("}") + 1);
        oldPath = prefix + renameMatch[1] + suffix;
        actualPath = prefix + renameMatch[2] + suffix;
      } else {
        const renameParts = filePath.split(" => ");
        oldPath = renameParts[0];
        actualPath = renameParts[1];
      }
    } else if (additions > 0 && deletions === 0) {
      status = "added";
    } else if (additions === 0 && deletions > 0) {
      status = "deleted";
    }

    fileMap.set(actualPath, {
      path: actualPath,
      status,
      additions,
      deletions,
      isGenerated: isGeneratedFile(actualPath),
      diff: "",
      oldPath,
    });
  }

  // Parse unified diff and assign to files
  if (diffOutput) {
    const fileDiffs = splitDiffByFile(diffOutput);
    for (const [path, diff] of fileDiffs) {
      const file = fileMap.get(path);
      if (file) {
        file.diff = diff;
      }
    }
  }

  return Array.from(fileMap.values());
}

function splitDiffByFile(diff: string): Map<string, string> {
  const result = new Map<string, string>();
  const lines = diff.split("\n");
  let currentPath = "";
  let currentLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("diff --git")) {
      // Save previous file
      if (currentPath && currentLines.length > 0) {
        result.set(currentPath, currentLines.join("\n"));
      }
      currentLines = [line];
      currentPath = "";
    } else if (line.startsWith("+++ b/") && !currentPath) {
      currentPath = line.replace("+++ b/", "");
      currentLines.push(line);
    } else if (line.startsWith("+++ /dev/null") && !currentPath) {
      // Deleted file — use the --- a/ path
      const prevLine = currentLines.find((l) => l.startsWith("--- a/"));
      if (prevLine) {
        currentPath = prevLine.replace("--- a/", "");
      }
      currentLines.push(line);
    } else {
      currentLines.push(line);
    }
  }

  // Save last file
  if (currentPath && currentLines.length > 0) {
    result.set(currentPath, currentLines.join("\n"));
  }

  return result;
}

export function getFileAtCommit(sha: string, path: string): string | null {
  // Allow hex SHAs with optional ~N or ^N suffix (parent refs)
  if (!/^[a-f0-9]{4,40}([~^]\d*)*$/i.test(sha)) return null;
  if (path.includes("..")) return null;

  try {
    return execSync(`git show ${sha}:${path}`, {
      cwd: getWorkspaceDir(),
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

export function commitToPullRequest(
  info: CommitInfo,
  files: DiffFile[]
): PullRequest {
  const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);

  return {
    sha: info.sha,
    shortSha: info.shortSha,
    title: info.title,
    body: info.body,
    author: info.author,
    date: info.date,
    parentSha: info.parentSha,
    files,
    totalAdditions,
    totalDeletions,
    // Backward compat
    status: "merged",
    checks: [],
    createdAt: info.date,
    description: info.body,
  };
}
