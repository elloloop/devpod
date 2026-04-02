"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  forwardRef,
} from "react";
import { ChevronRight, ChevronDown, Copy, Check, X, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DiffFile } from "@/lib/types";

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

// ─── Main DiffTable component ───────────────────────────────────

interface DiffTableProps {
  files: DiffFile[];
  sha: string;
  onFileClick?: (path: string) => void;
}

export function DiffTable({ files, sha, onFileClick }: DiffTableProps) {
  const [activeFile, setActiveFile] = useState<string>("");
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(() => {
    const generated = new Set<string>();
    for (const f of files) {
      if (f.isGenerated) generated.add(f.path);
    }
    return generated;
  });
  const [comments, setComments] = useState<InlineComment[]>(() =>
    getComments(sha)
  );
  const [commentingOn, setCommentingOn] = useState<{
    filePath: string;
    lineNumber: number;
    lineType: "old" | "new";
  } | null>(null);
  const [commentText, setCommentText] = useState("");

  const fileRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation: j/k for files
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      const currentIdx = files.findIndex((f) => f.path === activeFile);

      if (e.key === "j") {
        e.preventDefault();
        const nextIdx = Math.min(currentIdx + 1, files.length - 1);
        scrollToFile(files[nextIdx].path);
      } else if (e.key === "k") {
        e.preventDefault();
        const prevIdx = Math.max(currentIdx - 1, 0);
        scrollToFile(files[prevIdx].path);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeFile, files]);

  // Scroll spy
  useEffect(() => {
    const container = containerRef.current;
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
      { rootMargin: "-40px 0px -80% 0px", threshold: 0 }
    );

    for (const [, el] of fileRefs.current) {
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, [files]);

  const scrollToFile = useCallback(
    (path: string) => {
      const el = fileRefs.current.get(path);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        setActiveFile(path);
      }
      onFileClick?.(path);
    },
    [onFileClick]
  );

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
    saveComments(sha, updated);
    setCommentingOn(null);
    setCommentText("");
  }, [commentingOn, commentText, comments, sha]);

  const deleteComment = useCallback(
    (id: string) => {
      const updated = comments.filter((c) => c.id !== id);
      setComments(updated);
      saveComments(sha, updated);
    },
    [comments, sha]
  );

  return (
    <div ref={containerRef}>
      {files.map((file) => (
        <FileDiffSection
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
  );
}

// ─── File diff section ──────────────────────────────────────────

interface FileDiffSectionProps {
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

const FileDiffSection = forwardRef<HTMLDivElement, FileDiffSectionProps>(
  function FileDiffSection(
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

    const copyPath = (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(file.path);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    const totalChanges = file.additions + file.deletions;
    const addBlocks = totalChanges > 0 ? Math.round((file.additions / totalChanges) * 5) : 0;
    const delBlocks = totalChanges > 0 ? Math.round((file.deletions / totalChanges) * 5) : 0;

    return (
      <div
        ref={ref}
        data-file-path={file.path}
        style={{ borderBottom: "1px solid var(--diff-border)" }}
      >
        {/* Sticky file header */}
        <div
          className="sticky top-0 z-10 flex items-center gap-1.5 px-2 py-1 cursor-pointer select-none"
          style={{ backgroundColor: "var(--diff-bg-subtle)", borderBottom: "1px solid var(--diff-border)" }}
          onClick={onToggle}
        >
          <span className="shrink-0 w-4 h-4 flex items-center justify-center" style={{ color: "var(--diff-fg-muted)" }}>
            {isCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </span>

          <span
            className="font-mono text-xs truncate"
            style={{ color: "var(--diff-fg)" }}
          >
            {file.oldPath ? (
              <>
                <span style={{ color: "var(--diff-line-del-text)", textDecoration: "line-through" }}>{file.oldPath}</span>
                <span style={{ color: "var(--diff-fg-muted)" }}>{" -> "}</span>
                <span>{file.path}</span>
              </>
            ) : (
              file.path
            )}
          </span>

          {file.isGenerated && (
            <span
              className="text-[10px] px-1 py-0 rounded font-mono shrink-0"
              style={{ backgroundColor: "var(--diff-border)", color: "var(--diff-fg-muted)" }}
            >
              generated
            </span>
          )}

          <span className="ml-auto flex items-center gap-2 shrink-0">
            <span className="font-mono text-[11px]" style={{ color: "var(--diff-line-add-text)" }}>
              +{file.additions}
            </span>
            {file.deletions > 0 && (
              <span className="font-mono text-[11px]" style={{ color: "var(--diff-line-del-text)" }}>
                -{file.deletions}
              </span>
            )}
            {/* Visual change bar */}
            <span className="flex gap-px">
              {Array.from({ length: addBlocks }).map((_, i) => (
                <span key={`a${i}`} className="w-1.5 h-2 rounded-[1px]" style={{ backgroundColor: "var(--diff-line-add-text)" }} />
              ))}
              {Array.from({ length: delBlocks }).map((_, i) => (
                <span key={`d${i}`} className="w-1.5 h-2 rounded-[1px]" style={{ backgroundColor: "var(--diff-line-del-text)" }} />
              ))}
              {Array.from({ length: Math.max(0, 5 - addBlocks - delBlocks) }).map((_, i) => (
                <span key={`e${i}`} className="w-1.5 h-2 rounded-[1px]" style={{ backgroundColor: "var(--diff-gutter)" }} />
              ))}
            </span>
            <button
              onClick={copyPath}
              className="p-0.5 rounded hover:bg-white/10 transition-colors"
              title="Copy file path"
            >
              {copied ? (
                <Check className="h-3 w-3" style={{ color: "var(--diff-line-add-text)" }} />
              ) : (
                <Copy className="h-3 w-3" style={{ color: "var(--diff-fg-muted)" }} />
              )}
            </button>
          </span>
        </div>

        {/* Diff table */}
        {!isCollapsed && (
          <div className="overflow-x-auto">
            {hunks.length === 0 ? (
              <div
                className="px-4 py-3 text-center font-mono text-xs"
                style={{ color: "var(--diff-fg-muted)" }}
              >
                No diff content available
              </div>
            ) : (
              <table className="w-full border-collapse font-mono text-xs leading-[20px]" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "50px" }} />
                  <col style={{ width: "50px" }} />
                  <col />
                </colgroup>
                <tbody>
                  {hunks.map((hunk, hi) => {
                    const rows: React.ReactNode[] = [];

                    // Hunk header row
                    rows.push(
                      <tr key={`hunk-${hi}`} style={{ backgroundColor: "var(--diff-hunk-bg)" }}>
                        <td
                          colSpan={3}
                          className="px-2 py-0.5 font-mono text-xs"
                          style={{ color: "var(--diff-hunk-text)" }}
                        >
                          @@ -{hunk.oldStart} +{hunk.newStart} @@
                          {hunk.lines[0]?.type === "header" && hunk.lines[0].content && (
                            <span className="ml-2 opacity-60">{hunk.lines[0].content}</span>
                          )}
                        </td>
                      </tr>
                    );

                    // Diff lines
                    for (let li = 0; li < hunk.lines.length; li++) {
                      const line = hunk.lines[li];
                      if (line.type === "header") continue;

                      const lineKey = `${hi}-${li}`;
                      const lineNumber =
                        line.type === "remove" ? line.oldNumber : line.newNumber;
                      const lineType: "old" | "new" =
                        line.type === "remove" ? "old" : "new";

                      const lineComments = comments.filter(
                        (c) =>
                          c.lineNumber === lineNumber && c.lineType === lineType
                      );
                      const isCommenting =
                        commentingOn?.lineNumber === lineNumber &&
                        commentingOn?.lineType === lineType;

                      const bgColor =
                        line.type === "add"
                          ? "var(--diff-line-add-bg)"
                          : line.type === "remove"
                            ? "var(--diff-line-del-bg)"
                            : "transparent";

                      const gutterBg =
                        line.type === "add"
                          ? "var(--diff-line-add-bg)"
                          : line.type === "remove"
                            ? "var(--diff-line-del-bg)"
                            : "var(--diff-bg)";

                      rows.push(
                        <tr
                          key={lineKey}
                          className="group/line"
                          style={{ backgroundColor: bgColor }}
                          onMouseEnter={(e) => {
                            const hoverColor =
                              line.type === "add"
                                ? "var(--diff-line-add-hover)"
                                : line.type === "remove"
                                  ? "var(--diff-line-del-hover)"
                                  : "transparent";
                            e.currentTarget.style.backgroundColor = hoverColor;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = bgColor;
                          }}
                        >
                          {/* Old line number */}
                          <td
                            className="text-right pr-1.5 pl-1 select-none cursor-pointer align-top"
                            style={{
                              color: "var(--diff-gutter-text)",
                              borderRight: "1px solid var(--diff-gutter-border)",
                              backgroundColor: gutterBg,
                              width: "50px",
                              minWidth: "50px",
                            }}
                            onClick={() => {
                              if (line.oldNumber != null)
                                onLineClick(line.oldNumber, "old");
                            }}
                            title={line.oldNumber != null ? "Click to comment" : undefined}
                          >
                            {line.oldNumber ?? ""}
                          </td>
                          {/* New line number */}
                          <td
                            className="text-right pr-1.5 pl-1 select-none cursor-pointer align-top"
                            style={{
                              color: "var(--diff-gutter-text)",
                              borderRight: "1px solid var(--diff-gutter-border)",
                              backgroundColor: gutterBg,
                              width: "50px",
                              minWidth: "50px",
                            }}
                            onClick={() => {
                              if (line.newNumber != null)
                                onLineClick(line.newNumber, "new");
                            }}
                            title={line.newNumber != null ? "Click to comment" : undefined}
                          >
                            {line.newNumber ?? ""}
                          </td>
                          {/* Code content */}
                          <td className="pl-2 pr-4 whitespace-pre overflow-x-auto align-top">
                            <span
                              className="inline-block w-4 select-none text-center"
                              style={{
                                color:
                                  line.type === "add"
                                    ? "var(--diff-line-add-text)"
                                    : line.type === "remove"
                                      ? "var(--diff-line-del-text)"
                                      : "transparent",
                              }}
                            >
                              {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
                            </span>
                            <span
                              style={{
                                color:
                                  line.type === "context"
                                    ? "var(--diff-fg-muted)"
                                    : "var(--diff-fg)",
                              }}
                            >
                              {line.content}
                            </span>
                            {lineComments.length > 0 && (
                              <MessageSquare
                                className="inline-block ml-2 h-3 w-3 align-text-bottom"
                                style={{ color: "var(--diff-hunk-text)" }}
                              />
                            )}
                          </td>
                        </tr>
                      );

                      // Inline comments
                      for (const comment of lineComments) {
                        rows.push(
                          <tr key={`comment-${comment.id}`} style={{ backgroundColor: "var(--diff-hunk-bg)" }}>
                            <td colSpan={2} style={{ borderRight: "1px solid var(--diff-gutter-border)" }} />
                            <td className="px-3 py-1.5">
                              <div className="flex items-start gap-2">
                                <div
                                  className="rounded px-2 py-1.5 text-xs flex-1 font-sans"
                                  style={{
                                    backgroundColor: "var(--diff-bg)",
                                    border: "1px solid var(--diff-border)",
                                    color: "var(--diff-fg)",
                                  }}
                                >
                                  <p className="whitespace-pre-wrap">{comment.text}</p>
                                  <p className="text-[10px] mt-1" style={{ color: "var(--diff-fg-muted)" }}>
                                    {new Date(comment.timestamp).toLocaleString()}
                                  </p>
                                </div>
                                <button
                                  onClick={() => onDeleteComment(comment.id)}
                                  className="p-0.5 mt-1 rounded hover:bg-white/10"
                                >
                                  <X className="h-3 w-3" style={{ color: "var(--diff-fg-muted)" }} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      // Comment input
                      if (isCommenting) {
                        rows.push(
                          <tr key={`commenting-${lineKey}`} style={{ backgroundColor: "var(--diff-hunk-bg)" }}>
                            <td colSpan={2} style={{ borderRight: "1px solid var(--diff-gutter-border)" }} />
                            <td className="px-3 py-1.5">
                              <textarea
                                autoFocus
                                className="w-full rounded px-2 py-1.5 text-xs font-sans resize-none outline-none"
                                style={{
                                  backgroundColor: "var(--diff-bg)",
                                  border: "1px solid var(--diff-border)",
                                  color: "var(--diff-fg)",
                                }}
                                rows={2}
                                placeholder="Add a comment..."
                                value={commentText}
                                onChange={(e) => onCommentTextChange(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && e.metaKey) {
                                    onSubmitComment();
                                  }
                                  if (e.key === "Escape") {
                                    onCancelComment();
                                  }
                                }}
                              />
                              <div className="flex items-center gap-2 mt-1">
                                <Button
                                  size="xs"
                                  onClick={onSubmitComment}
                                  disabled={!commentText.trim()}
                                  className="h-5 text-[10px] px-2"
                                >
                                  Comment
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  onClick={onCancelComment}
                                  className="h-5 text-[10px] px-2"
                                >
                                  Cancel
                                </Button>
                                <span className="text-[10px] ml-auto font-sans" style={{ color: "var(--diff-fg-muted)" }}>
                                  Cmd+Enter to submit
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                    }

                    return rows;
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    );
  }
);
