"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { DiffFile } from "@/lib/types";

interface FileListBarProps {
  files: DiffFile[];
  onFileClick: (path: string) => void;
  className?: string;
}

export function FileListBar({ files, onFileClick, className }: FileListBarProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div
      className={cn("font-mono text-xs", className)}
      style={{ borderBottom: "1px solid var(--diff-border)" }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 w-full px-2 py-1 hover:bg-white/5 transition-colors"
        style={{ color: "var(--diff-fg-muted)" }}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        <span>{files.length} {files.length === 1 ? "file" : "files"} changed</span>
      </button>
      {expanded && (
        <div className="pb-1">
          {files.map((file) => {
            const totalChanges = file.additions + file.deletions;
            const maxBlocks = 10;
            const addBlocks = totalChanges > 0 ? Math.round((file.additions / totalChanges) * maxBlocks) : 0;
            const delBlocks = totalChanges > 0 ? Math.round((file.deletions / totalChanges) * maxBlocks) : 0;
            const emptyBlocks = Math.max(0, maxBlocks - addBlocks - delBlocks);

            // Show just the filename, with directory dimmed
            const lastSlash = file.path.lastIndexOf("/");
            const dir = lastSlash >= 0 ? file.path.substring(0, lastSlash + 1) : "";
            const name = lastSlash >= 0 ? file.path.substring(lastSlash + 1) : file.path;

            return (
              <button
                key={file.path}
                onClick={() => onFileClick(file.path)}
                className="flex items-center gap-2 w-full px-3 py-0.5 hover:bg-white/5 transition-colors text-left"
              >
                <span className="truncate flex-1 min-w-0">
                  <span style={{ color: "var(--diff-fg-muted)" }}>{dir}</span>
                  <span style={{ color: "var(--diff-fg)" }}>{name}</span>
                </span>
                <span className="shrink-0 flex items-center gap-1.5">
                  <span style={{ color: "var(--diff-line-add-text)" }}>+{file.additions}</span>
                  {file.deletions > 0 && (
                    <span style={{ color: "var(--diff-line-del-text)" }}>-{file.deletions}</span>
                  )}
                  <span className="flex gap-px ml-1">
                    {Array.from({ length: addBlocks }).map((_, i) => (
                      <span
                        key={`a${i}`}
                        className="w-1 h-2 rounded-[1px]"
                        style={{ backgroundColor: "var(--diff-line-add-text)" }}
                      />
                    ))}
                    {Array.from({ length: delBlocks }).map((_, i) => (
                      <span
                        key={`d${i}`}
                        className="w-1 h-2 rounded-[1px]"
                        style={{ backgroundColor: "var(--diff-line-del-text)" }}
                      />
                    ))}
                    {Array.from({ length: emptyBlocks }).map((_, i) => (
                      <span
                        key={`e${i}`}
                        className="w-1 h-2 rounded-[1px]"
                        style={{ backgroundColor: "var(--diff-gutter)" }}
                      />
                    ))}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
