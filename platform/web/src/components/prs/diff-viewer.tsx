"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronRight,
  ChevronDown,
  FilePlus,
  FileX,
  FileCode,
  FolderOpen,
  Copy,
  Check,
  PanelLeftClose,
  PanelLeft,
  MessageSquare,
  X,
} from "lucide-react";
import type { PullRequest, DiffFile } from "@/lib/types";

// ─── Diff parsing ───────────────────────────────────────────────

interface DiffHunk {
  header: string;
  oldStart: number;
  newStart: number;
  lines: DiffLine[];
}

interface DiffLine {
  type: "add" | "remove" | "context" | "header";
  content: string;
  oldNumber?: number;
  newNumber?: number;
}

function parseFileDiff(diff: string): DiffHunk[] {
  if (!diff) return [];
  const hunks: DiffHunk[] = [];
  const lines = diff.split("\n");
  let currentHunk: DiffHunk | null = null;
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    if (line.startsWith("diff --git")) continue;
    if (line.startsWith("index ")) continue;
    if (line.startsWith("--- ")) continue;
    if (line.startsWith("+++ ")) continue;
    if (line.startsWith("old mode") || line.startsWith("new mode")) continue;
    if (line.startsWith("new file") || line.startsWith("deleted file")) continue;
    if (line.startsWith("similarity index") || line.startsWith("rename ")) continue;
    if (line.startsWith("Binary files")) {
      hunks.push({
        header: "Binary file changed",
        oldStart: 0,
        newStart: 0,
        lines: [{ type: "header", content: "Binary file changed" }],
      });
      continue;
    }

    if (line.startsWith("@@")) {
      const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@(.*)/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
        currentHunk = {
          header: line,
          oldStart: oldLine,
          newStart: newLine,
          lines: [
            {
              type: "header",
              content: match[3]?.trim() || "",
            },
          ],
        };
        hunks.push(currentHunk);
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

  return hunks;
}

// ─── File tree helpers ──────────────────────────────────────────

interface FileTreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: FileTreeNode[];
  file?: DiffFile;
}

function buildFileTree(files: DiffFile[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];

  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isLast = i === parts.length - 1;
      const fullPath = parts.slice(0, i + 1).join("/");

      let existing = current.find((n) => n.name === name);
      if (!existing) {
        existing = {
          name,
          path: fullPath,
          isDir: !isLast,
          children: [],
          file: isLast ? file : undefined,
        };
        current.push(existing);
      }
      current = existing.children;
    }
  }

  // Collapse single-child directories
  function collapse(nodes: FileTreeNode[]): FileTreeNode[] {
    return nodes.map((node) => {
      while (
        node.isDir &&
        node.children.length === 1 &&
        node.children[0].isDir
      ) {
        const child = node.children[0];
        node = {
          ...node,
          name: `${node.name}/${child.name}`,
          path: child.path,
          children: child.children,
        };
      }
      node.children = collapse(node.children);
      return node;
    });
  }

  return collapse(root);
}

// ─── Inline comment storage ─────────────────────────────────────

interface InlineComment {
  id: string;
  filePath: string;
  lineNumber: number;
  lineType: "old" | "new";
  text: string;
  timestamp: string;
}

function getComments(sha: string): InlineComment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`diff-comments-${sha}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveComments(sha: string, comments: InlineComment[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`diff-comments-${sha}`, JSON.stringify(comments));
}

// ─── Components ─────────────────────────────────────────────────

interface DiffViewerProps {
  pr: PullRequest;
}

export function DiffViewer({ pr }: DiffViewerProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeFile, setActiveFile] = useState<string>("");
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(() => {
    const generated = new Set<string>();
    for (const f of pr.files) {
      if (f.isGenerated) generated.add(f.path);
    }
    return generated;
  });
  const [comments, setComments] = useState<InlineComment[]>(() =>
    getComments(pr.sha)
  );
  const [commentingOn, setCommentingOn] = useState<{
    filePath: string;
    lineNumber: number;
    lineType: "old" | "new";
  } | null>(null);
  const [commentText, setCommentText] = useState("");

  const fileRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const diffContainerRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      const fileList = pr.files;
      const currentIdx = fileList.findIndex((f) => f.path === activeFile);

      if (e.key === "j") {
        e.preventDefault();
        const nextIdx = Math.min(currentIdx + 1, fileList.length - 1);
        scrollToFile(fileList[nextIdx].path);
      } else if (e.key === "k") {
        e.preventDefault();
        const prevIdx = Math.max(currentIdx - 1, 0);
        scrollToFile(fileList[prevIdx].path);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeFile, pr.files]);

  // Scroll spy
  useEffect(() => {
    const container = diffContainerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const path = entry.target.getAttribute("data-file-path");
            if (path) setActiveFile(path);
          }
        }
      },
      { root: container, rootMargin: "-64px 0px -80% 0px", threshold: 0 }
    );

    for (const [, el] of fileRefs.current) {
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, [pr.files]);

  const scrollToFile = useCallback((path: string) => {
    const el = fileRefs.current.get(path);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveFile(path);
    }
  }, []);

  const toggleFile = useCallback((path: string) => {
    setCollapsedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const addComment = useCallback(() => {
    if (!commentingOn || !commentText.trim()) return;
    const newComment: InlineComment = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      filePath: commentingOn.filePath,
      lineNumber: commentingOn.lineNumber,
      lineType: commentingOn.lineType,
      text: commentText.trim(),
      timestamp: new Date().toISOString(),
    };
    const updated = [...comments, newComment];
    setComments(updated);
    saveComments(pr.sha, updated);
    setCommentingOn(null);
    setCommentText("");
  }, [commentingOn, commentText, comments, pr.sha]);

  const deleteComment = useCallback(
    (id: string) => {
      const updated = comments.filter((c) => c.id !== id);
      setComments(updated);
      saveComments(pr.sha, updated);
    },
    [comments, pr.sha]
  );

  const fileTree = useMemo(() => buildFileTree(pr.files), [pr.files]);

  return (
    <div className="flex h-[calc(100vh-200px)] border rounded-lg overflow-hidden">
      {/* File tree sidebar */}
      {sidebarOpen && (
        <div className="w-[280px] shrink-0 border-r flex flex-col bg-card">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Files ({pr.files.length})
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setSidebarOpen(false)}
              title="Hide file tree"
            >
              <PanelLeftClose className="h-3.5 w-3.5" />
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="py-1">
              <FileTreeView
                nodes={fileTree}
                activeFile={activeFile}
                onSelectFile={scrollToFile}
                collapsedFiles={collapsedFiles}
              />
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Diff content */}
      <div className="flex-1 flex flex-col min-w-0">
        {!sidebarOpen && (
          <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-card">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setSidebarOpen(true)}
              title="Show file tree"
            >
              <PanelLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground">
              {pr.files.length} files changed
            </span>
          </div>
        )}
        <div ref={diffContainerRef} className="flex-1 overflow-auto">
          <div className="divide-y">
            {pr.files.map((file) => (
              <FileSection
                key={file.path}
                file={file}
                isCollapsed={collapsedFiles.has(file.path)}
                onToggle={() => toggleFile(file.path)}
                onLineClick={(lineNumber, lineType) =>
                  setCommentingOn({
                    filePath: file.path,
                    lineNumber,
                    lineType,
                  })
                }
                comments={comments.filter((c) => c.filePath === file.path)}
                commentingOn={
                  commentingOn?.filePath === file.path ? commentingOn : null
                }
                commentText={commentText}
                onCommentTextChange={setCommentText}
                onSubmitComment={addComment}
                onCancelComment={() => {
                  setCommentingOn(null);
                  setCommentText("");
                }}
                onDeleteComment={deleteComment}
                ref={(el) => {
                  if (el) fileRefs.current.set(file.path, el);
                  else fileRefs.current.delete(file.path);
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── File tree sidebar item ─────────────────────────────────────

function FileTreeView({
  nodes,
  activeFile,
  onSelectFile,
  collapsedFiles,
  depth = 0,
}: {
  nodes: FileTreeNode[];
  activeFile: string;
  onSelectFile: (path: string) => void;
  collapsedFiles: Set<string>;
  depth?: number;
}) {
  return (
    <>
      {nodes.map((node) => (
        <FileTreeItem
          key={node.path}
          node={node}
          activeFile={activeFile}
          onSelectFile={onSelectFile}
          collapsedFiles={collapsedFiles}
          depth={depth}
        />
      ))}
    </>
  );
}

function FileTreeItem({
  node,
  activeFile,
  onSelectFile,
  collapsedFiles,
  depth,
}: {
  node: FileTreeNode;
  activeFile: string;
  onSelectFile: (path: string) => void;
  collapsedFiles: Set<string>;
  depth: number;
}) {
  const [dirOpen, setDirOpen] = useState(true);

  if (node.isDir) {
    return (
      <div>
        <button
          onClick={() => setDirOpen(!dirOpen)}
          className="flex items-center gap-1 w-full px-2 py-1 text-xs text-muted-foreground hover:bg-accent/50 transition-colors"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {dirOpen ? (
            <ChevronDown className="h-3 w-3 shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0" />
          )}
          <FolderOpen className="h-3 w-3 shrink-0 text-blue-400" />
          <span className="truncate font-mono">{node.name}</span>
        </button>
        {dirOpen && (
          <FileTreeView
            nodes={node.children}
            activeFile={activeFile}
            onSelectFile={onSelectFile}
            collapsedFiles={collapsedFiles}
            depth={depth + 1}
          />
        )}
      </div>
    );
  }

  const file = node.file!;
  const isActive = activeFile === file.path;
  const StatusIcon =
    file.status === "added"
      ? FilePlus
      : file.status === "deleted"
        ? FileX
        : FileCode;
  const statusColor =
    file.status === "added"
      ? "text-emerald-400"
      : file.status === "deleted"
        ? "text-red-400"
        : "text-yellow-400";

  return (
    <button
      onClick={() => onSelectFile(file.path)}
      className={cn(
        "flex items-center gap-1.5 w-full px-2 py-1 text-xs transition-colors",
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/50"
      )}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <StatusIcon className={cn("h-3 w-3 shrink-0", statusColor)} />
      <span className="truncate font-mono">{node.name}</span>
      <span className="ml-auto flex items-center gap-1 shrink-0">
        {file.isGenerated && (
          <Badge
            variant="secondary"
            className="text-[9px] px-1 py-0 h-3.5 font-normal"
          >
            gen
          </Badge>
        )}
        <span className="text-emerald-400/70 text-[10px]">
          +{file.additions}
        </span>
        {file.deletions > 0 && (
          <span className="text-red-400/70 text-[10px]">
            -{file.deletions}
          </span>
        )}
      </span>
    </button>
  );
}

// ─── File diff section ──────────────────────────────────────────

interface FileSectionProps {
  file: DiffFile;
  isCollapsed: boolean;
  onToggle: () => void;
  onLineClick: (lineNumber: number, lineType: "old" | "new") => void;
  comments: InlineComment[];
  commentingOn: { lineNumber: number; lineType: "old" | "new" } | null;
  commentText: string;
  onCommentTextChange: (text: string) => void;
  onSubmitComment: () => void;
  onCancelComment: () => void;
  onDeleteComment: (id: string) => void;
}

import { forwardRef } from "react";

const FileSection = forwardRef<HTMLDivElement, FileSectionProps>(
  function FileSection(
    {
      file,
      isCollapsed,
      onToggle,
      onLineClick,
      comments,
      commentingOn,
      commentText,
      onCommentTextChange,
      onSubmitComment,
      onCancelComment,
      onDeleteComment,
    },
    ref
  ) {
    const [copied, setCopied] = useState(false);
    const hunks = useMemo(() => parseFileDiff(file.diff), [file.diff]);

    const copyPath = () => {
      navigator.clipboard.writeText(file.path);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    const StatusIcon =
      file.status === "added"
        ? FilePlus
        : file.status === "deleted"
          ? FileX
          : FileCode;
    const statusColor =
      file.status === "added"
        ? "text-emerald-400"
        : file.status === "deleted"
          ? "text-red-400"
          : "text-yellow-400";

    return (
      <div ref={ref} data-file-path={file.path}>
        {/* Sticky file header */}
        <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-2 bg-muted/80 backdrop-blur-sm border-b">
          <button onClick={onToggle} className="shrink-0">
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          <StatusIcon className={cn("h-4 w-4 shrink-0", statusColor)} />
          <span className="font-mono text-sm truncate">
            {file.oldPath ? (
              <>
                <span className="text-red-400 line-through">{file.oldPath}</span>
                <span className="text-muted-foreground mx-1">{"->"}</span>
                <span>{file.path}</span>
              </>
            ) : (
              file.path
            )}
          </span>
          {file.isGenerated && (
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 h-4 font-normal shrink-0"
            >
              Generated file
            </Badge>
          )}
          <span className="ml-auto flex items-center gap-2 shrink-0">
            <span className="text-xs font-mono text-emerald-400">
              +{file.additions}
            </span>
            {file.deletions > 0 && (
              <span className="text-xs font-mono text-red-400">
                -{file.deletions}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={copyPath}
              title="Copy file path"
            >
              {copied ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </span>
        </div>

        {/* Diff content */}
        {!isCollapsed && (
          <div className="font-mono text-xs leading-5">
            {hunks.length === 0 ? (
              <div className="px-4 py-6 text-center text-muted-foreground text-sm">
                No diff content available
              </div>
            ) : (
              hunks.map((hunk, hi) => (
                <div key={hi}>
                  {/* Hunk header */}
                  <div className="flex bg-blue-500/5 text-blue-400/80 border-y border-blue-500/10">
                    <span className="w-[52px] shrink-0" />
                    <span className="w-[52px] shrink-0" />
                    <span className="w-5 shrink-0" />
                    <span className="py-0.5 pr-4">
                      @@ -{hunk.oldStart} +{hunk.newStart} @@
                      {hunk.lines[0]?.type === "header" &&
                        hunk.lines[0].content && (
                          <span className="ml-2 text-blue-400/50">
                            {hunk.lines[0].content}
                          </span>
                        )}
                    </span>
                  </div>

                  {/* Diff lines */}
                  {hunk.lines.map((line, li) => {
                    if (line.type === "header") return null;

                    const lineKey = `${hi}-${li}`;
                    const lineNumber =
                      line.type === "remove"
                        ? line.oldNumber
                        : line.newNumber;
                    const lineType: "old" | "new" =
                      line.type === "remove" ? "old" : "new";

                    // Check for comments on this line
                    const lineComments = comments.filter(
                      (c) =>
                        c.lineNumber === lineNumber &&
                        c.lineType === lineType
                    );
                    const isCommenting =
                      commentingOn?.lineNumber === lineNumber &&
                      commentingOn?.lineType === lineType;

                    return (
                      <div key={lineKey}>
                        <div
                          className={cn(
                            "flex group",
                            line.type === "add" && "bg-[#0d2117]",
                            line.type === "remove" && "bg-[#2d0f12]",
                            line.type === "context" && "bg-transparent"
                          )}
                        >
                          {/* Old line number */}
                          <button
                            className="w-[52px] text-right pr-2 select-none opacity-40 hover:opacity-100 border-r border-border/50 shrink-0 py-0.5 tabular-nums transition-opacity"
                            onClick={() => {
                              if (line.oldNumber != null)
                                onLineClick(line.oldNumber, "old");
                            }}
                            title={
                              line.oldNumber != null
                                ? "Click to comment"
                                : undefined
                            }
                          >
                            {line.oldNumber ?? ""}
                          </button>
                          {/* New line number */}
                          <button
                            className="w-[52px] text-right pr-2 select-none opacity-40 hover:opacity-100 border-r border-border/50 shrink-0 py-0.5 tabular-nums transition-opacity"
                            onClick={() => {
                              if (line.newNumber != null)
                                onLineClick(line.newNumber, "new");
                            }}
                            title={
                              line.newNumber != null
                                ? "Click to comment"
                                : undefined
                            }
                          >
                            {line.newNumber ?? ""}
                          </button>
                          {/* +/- indicator */}
                          <span
                            className={cn(
                              "w-5 text-center select-none shrink-0 py-0.5",
                              line.type === "add" && "text-emerald-400",
                              line.type === "remove" && "text-red-400"
                            )}
                          >
                            {line.type === "add"
                              ? "+"
                              : line.type === "remove"
                                ? "-"
                                : " "}
                          </span>
                          {/* Content */}
                          <pre
                            className={cn(
                              "flex-1 py-0.5 pr-4 whitespace-pre overflow-x-auto",
                              line.type === "add" && "text-emerald-200/90",
                              line.type === "remove" && "text-red-200/90",
                              line.type === "context" && "text-zinc-400"
                            )}
                          >
                            {line.content}
                          </pre>
                          {/* Comment indicator */}
                          <span className="w-8 shrink-0 flex items-center justify-center">
                            {lineComments.length > 0 && (
                              <MessageSquare className="h-3 w-3 text-blue-400" />
                            )}
                          </span>
                        </div>

                        {/* Inline comments */}
                        {lineComments.map((comment) => (
                          <div
                            key={comment.id}
                            className="flex bg-blue-500/5 border-y border-blue-500/10"
                          >
                            <span className="w-[52px] shrink-0" />
                            <span className="w-[52px] shrink-0" />
                            <span className="w-5 shrink-0" />
                            <div className="flex-1 px-3 py-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="rounded-md bg-muted/50 border px-3 py-2 text-sm flex-1">
                                  <p className="whitespace-pre-wrap font-sans text-foreground">
                                    {comment.text}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground mt-1 font-sans">
                                    {new Date(
                                      comment.timestamp
                                    ).toLocaleString()}
                                  </p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={() => onDeleteComment(comment.id)}
                                  className="shrink-0 mt-1"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Comment input */}
                        {isCommenting && (
                          <div className="flex bg-blue-500/5 border-y border-blue-500/10">
                            <span className="w-[52px] shrink-0" />
                            <span className="w-[52px] shrink-0" />
                            <span className="w-5 shrink-0" />
                            <div className="flex-1 px-3 py-2">
                              <textarea
                                autoFocus
                                className="w-full rounded-md bg-muted/50 border px-3 py-2 text-sm font-sans text-foreground resize-none outline-none focus:ring-1 focus:ring-ring"
                                rows={2}
                                placeholder="Add a comment..."
                                value={commentText}
                                onChange={(e) =>
                                  onCommentTextChange(e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && e.metaKey) {
                                    onSubmitComment();
                                  }
                                  if (e.key === "Escape") {
                                    onCancelComment();
                                  }
                                }}
                              />
                              <div className="flex items-center gap-2 mt-1.5">
                                <Button
                                  size="xs"
                                  onClick={onSubmitComment}
                                  disabled={!commentText.trim()}
                                >
                                  Comment
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  onClick={onCancelComment}
                                >
                                  Cancel
                                </Button>
                                <span className="text-[10px] text-muted-foreground ml-auto font-sans">
                                  Cmd+Enter to submit
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  }
);
