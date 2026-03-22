"use client";

import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { File, Plus, Minus } from "lucide-react";
import type { PullRequest } from "@/lib/types";

interface DiffViewerProps {
  pr: PullRequest;
}

interface DiffFile {
  path: string;
  hunks: DiffHunk[];
}

interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

interface DiffLine {
  type: "add" | "remove" | "context" | "header";
  content: string;
  oldNumber?: number;
  newNumber?: number;
}

function parseDiff(diff: string): DiffFile[] {
  const files: DiffFile[] = [];
  const lines = diff.split("\n");
  let currentFile: DiffFile | null = null;
  let currentHunk: DiffHunk | null = null;
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    if (line.startsWith("--- a/") || line.startsWith("--- /dev/null")) {
      continue;
    }

    if (line.startsWith("+++ b/") || line.startsWith("+++ /dev/null")) {
      const path = line.replace("+++ b/", "").replace("+++ /dev/null", "/dev/null");
      currentFile = { path, hunks: [] };
      files.push(currentFile);
      continue;
    }

    if (line.startsWith("@@")) {
      const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@(.*)/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
        currentHunk = {
          header: line,
          lines: [{ type: "header", content: line }],
        };
        currentFile?.hunks.push(currentHunk);
      }
      continue;
    }

    if (!currentHunk) continue;

    if (line.startsWith("+")) {
      currentHunk.lines.push({
        type: "add",
        content: line.substring(1),
        newNumber: newLine++,
      });
    } else if (line.startsWith("-")) {
      currentHunk.lines.push({
        type: "remove",
        content: line.substring(1),
        oldNumber: oldLine++,
      });
    } else if (line.startsWith(" ") || line === "") {
      currentHunk.lines.push({
        type: "context",
        content: line.substring(1) || "",
        oldNumber: oldLine++,
        newNumber: newLine++,
      });
    }
  }

  return files;
}

export function DiffViewer({ pr }: DiffViewerProps) {
  const files = parseDiff(pr.diff);

  return (
    <div className="space-y-4">
      {/* File summary */}
      <div className="flex flex-wrap gap-2 text-sm">
        {pr.files.map((f) => (
          <div
            key={f.path}
            className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5"
          >
            <File className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-mono text-xs">{f.path}</span>
            <span className="flex items-center gap-1">
              <span className="text-emerald-400 text-xs flex items-center">
                <Plus className="h-3 w-3" />
                {f.additions}
              </span>
              {f.deletions > 0 && (
                <span className="text-red-400 text-xs flex items-center">
                  <Minus className="h-3 w-3" />
                  {f.deletions}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>

      {/* Diff output */}
      {files.map((file) => (
        <div key={file.path} className="rounded-lg border overflow-hidden">
          <div className="bg-muted px-4 py-2 border-b flex items-center gap-2">
            <File className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-sm">{file.path}</span>
          </div>
          <ScrollArea className="max-h-[600px]">
            <div className="font-mono text-xs">
              {file.hunks.map((hunk, hi) => (
                <div key={hi}>
                  {hunk.lines.map((line, li) => (
                    <div
                      key={`${hi}-${li}`}
                      className={cn(
                        "flex",
                        line.type === "add" &&
                          "bg-emerald-500/10 text-emerald-300",
                        line.type === "remove" &&
                          "bg-red-500/10 text-red-300",
                        line.type === "header" &&
                          "bg-blue-500/10 text-blue-300",
                        line.type === "context" && "text-muted-foreground"
                      )}
                    >
                      {line.type !== "header" && (
                        <>
                          <span className="w-12 text-right pr-2 select-none opacity-50 border-r border-border shrink-0 px-2 py-0.5">
                            {line.oldNumber ?? ""}
                          </span>
                          <span className="w-12 text-right pr-2 select-none opacity-50 border-r border-border shrink-0 px-2 py-0.5">
                            {line.newNumber ?? ""}
                          </span>
                        </>
                      )}
                      <span className="w-6 text-center select-none shrink-0 py-0.5">
                        {line.type === "add"
                          ? "+"
                          : line.type === "remove"
                            ? "-"
                            : line.type === "header"
                              ? ""
                              : " "}
                      </span>
                      <pre className="flex-1 py-0.5 pr-4 whitespace-pre-wrap break-all">
                        {line.type === "header"
                          ? line.content
                          : line.content}
                      </pre>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      ))}
    </div>
  );
}
