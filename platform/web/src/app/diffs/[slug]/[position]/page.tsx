"use client";

import { use, useEffect, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useFeaturesDiffs } from "@/lib/hooks/use-diffs";
import type { DiffFile } from "@/lib/types";

// ────────────────────────────────────────────────────────────
// Unified diff parser — extracts line numbers and line types
// ────────────────────────────────────────────────────────────

interface DiffLine {
  type: "add" | "del" | "context" | "hunk" | "meta";
  content: string;
  oldNum: number | null;
  newNum: number | null;
}

function parseDiff(raw: string): DiffLine[] {
  const lines: DiffLine[] = [];
  let oldNum = 0;
  let newNum = 0;

  for (const line of raw.split("\n")) {
    if (
      line.startsWith("diff --git") ||
      line.startsWith("index ") ||
      line.startsWith("new file") ||
      line.startsWith("deleted file") ||
      line.startsWith("--- ") ||
      line.startsWith("+++ ")
    ) {
      continue; // skip meta headers
    }

    if (line.startsWith("@@")) {
      // Parse hunk header: @@ -oldStart,oldLen +newStart,newLen @@
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldNum = parseInt(match[1], 10);
        newNum = parseInt(match[2], 10);
      }
      lines.push({ type: "hunk", content: line, oldNum: null, newNum: null });
      continue;
    }

    if (line.startsWith("+")) {
      lines.push({ type: "add", content: line.slice(1), oldNum: null, newNum: newNum++ });
    } else if (line.startsWith("-")) {
      lines.push({ type: "del", content: line.slice(1), oldNum: oldNum++, newNum: null });
    } else if (line.startsWith(" ")) {
      lines.push({ type: "context", content: line.slice(1), oldNum: oldNum++, newNum: newNum++ });
    } else if (line === "") {
      // empty line in context
      lines.push({ type: "context", content: "", oldNum: oldNum++, newNum: newNum++ });
    }
  }

  return lines;
}

// ────────────────────────────────────────────────────────────
// Basic syntax highlighting — tokens for common languages
// ────────────────────────────────────────────────────────────

const KEYWORDS = new Set([
  "import", "export", "from", "const", "let", "var", "function", "return",
  "if", "else", "for", "while", "class", "interface", "type", "extends",
  "async", "await", "new", "this", "true", "false", "null", "undefined",
  "default", "switch", "case", "break", "continue", "throw", "try", "catch",
  "finally", "typeof", "instanceof", "in", "of", "void", "delete", "yield",
]);

function highlightLine(text: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  let i = 0;

  while (i < text.length) {
    // String literals
    if (text[i] === '"' || text[i] === "'" || text[i] === "`") {
      const quote = text[i];
      let j = i + 1;
      while (j < text.length && text[j] !== quote) {
        if (text[j] === "\\") j++; // skip escaped
        j++;
      }
      j++; // include closing quote
      tokens.push(
        <span key={i} style={{ color: "#a5d6a7" }}>
          {text.slice(i, j)}
        </span>
      );
      i = j;
      continue;
    }

    // Line comments
    if (text[i] === "/" && text[i + 1] === "/") {
      tokens.push(
        <span key={i} style={{ color: "#616161" }}>
          {text.slice(i)}
        </span>
      );
      break;
    }

    // Numbers
    if (/\d/.test(text[i]) && (i === 0 || /\W/.test(text[i - 1]))) {
      let j = i;
      while (j < text.length && /[\d.]/.test(text[j])) j++;
      tokens.push(
        <span key={i} style={{ color: "#f48fb1" }}>
          {text.slice(i, j)}
        </span>
      );
      i = j;
      continue;
    }

    // Words (keywords, identifiers)
    if (/[a-zA-Z_$]/.test(text[i])) {
      let j = i;
      while (j < text.length && /[a-zA-Z0-9_$]/.test(text[j])) j++;
      const word = text.slice(i, j);
      if (KEYWORDS.has(word)) {
        tokens.push(
          <span key={i} style={{ color: "#82b1ff" }}>
            {word}
          </span>
        );
      } else {
        tokens.push(<span key={i}>{word}</span>);
      }
      i = j;
      continue;
    }

    // Operators and punctuation
    tokens.push(<span key={i}>{text[i]}</span>);
    i++;
  }

  return tokens;
}

// ────────────────────────────────────────────────────────────
// Themes
// ────────────────────────────────────────────────────────────

type ThemeName = "vscode" | "github";

const themes: Record<ThemeName, typeof VSCODE_THEME> = {
  vscode: {
    bg: "#1e1e1e",
    bgSidebar: "#252526",
    bgHeader: "#2d2d2d",
    bgHunk: "#1a1a2e",
    bgAdd: "#1e3a2a",
    bgDel: "#3a1e1e",
    bgAddGutter: "#264f38",
    bgDelGutter: "#4f2626",
    bgGutter: "#1e1e1e",
    borderGutter: "#333333",
    border: "#333333",
    textPrimary: "#d4d4d4",
    textSecondary: "#858585",
    textGutter: "#4e4e4e",
    textGutterAdd: "#4e8a5e",
    textGutterDel: "#8a4e4e",
    textHunk: "#569cd6",
    textAdd: "#b5cea8",
    textDel: "#ce9178",
    textAccent: "#569cd6",
    textSuccess: "#4ec9b0",
    textError: "#f44747",
    font: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Consolas, monospace",
    fontSize: "13px",
    lineHeight: "20px",
  },
  github: {
    bg: "#0d1117",
    bgSidebar: "#161b22",
    bgHeader: "#161b22",
    bgHunk: "#1c2233",
    bgAdd: "#12261e",
    bgDel: "#2d1215",
    bgAddGutter: "#1a4028",
    bgDelGutter: "#421c1f",
    bgGutter: "#0d1117",
    borderGutter: "#21262d",
    border: "#21262d",
    textPrimary: "#e6edf3",
    textSecondary: "#8b949e",
    textGutter: "#3b4252",
    textGutterAdd: "#2ea04f",
    textGutterDel: "#da3633",
    textHunk: "#79c0ff",
    textAdd: "#aff5b4",
    textDel: "#ffa8a8",
    textAccent: "#58a6ff",
    textSuccess: "#3fb950",
    textError: "#f85149",
    font: "'SF Mono', 'Fira Code', Menlo, Consolas, monospace",
    fontSize: "12px",
    lineHeight: "20px",
  },
};

const VSCODE_THEME = themes.vscode;

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

async function fetchDiff(slug: string, position: number) {
  const res = await fetch(`/api/diffs/${slug}/${position}`);
  if (!res.ok) return null;
  return res.json();
}

export default function DiffReviewPage({
  params,
}: {
  params: Promise<{ slug: string; position: string }>;
}) {
  const { slug, position } = use(params);
  const posNum = parseInt(position, 10);
  const router = useRouter();
  const { data: allFeatures } = useFeaturesDiffs();
  const parentFeature = allFeatures?.find((f) => f.feature.slug === slug);
  const siblingDiffs = parentFeature?.diffs ?? [];

  const [themeName, setThemeName] = useState<ThemeName>("vscode");
  const S = themes[themeName];

  const { data: diff, isLoading } = useQuery({
    queryKey: ["diff-detail", slug, posNum],
    queryFn: () => fetchDiff(slug, posNum),
  });

  // Keyboard: n/p for stack navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "n") {
        if (siblingDiffs.find((d) => d.position === posNum + 1)) router.push(`/diffs/${slug}/${posNum + 1}`);
      } else if (e.key === "p" && posNum > 1) {
        if (siblingDiffs.find((d) => d.position === posNum - 1)) router.push(`/diffs/${slug}/${posNum - 1}`);
      }
    },
    [posNum, siblingDiffs, slug, router]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const files: DiffFile[] = useMemo(() => diff?.detailedFiles ?? diff?.files ?? [], [diff]);

  // ── Loading ──
  if (isLoading) {
    return (
      <div style={{ background: S.bg, color: S.textSecondary, height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: S.font, fontSize: "12px" }}>
        Loading...
      </div>
    );
  }

  // ── Not found ──
  if (!diff) {
    return (
      <div style={{ background: S.bg, color: S.textSecondary, height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: S.font, fontSize: "13px" }}>
        <div style={{ textAlign: "center" }}>
          <div>D{position} not found in {slug}</div>
          <Link href={`/diffs/${slug}`} style={{ color: S.textAccent, marginTop: 12, display: "inline-block", fontSize: "12px" }}>
            ← Back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: S.bg, color: S.textPrimary, height: "100vh", display: "flex", flexDirection: "column", fontFamily: S.font }}>

      {/* ── Top bar ── */}
      <div style={{ height: 36, display: "flex", alignItems: "center", padding: "0 12px", gap: 8, borderBottom: `1px solid ${S.border}`, background: S.bgHeader, fontSize: "12px", flexShrink: 0 }}>
        <Link href={`/diffs/${slug}`} style={{ color: S.textSecondary, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
          ← {parentFeature?.feature.name || slug}
        </Link>
        <span style={{ color: "#555" }}>·</span>
        <span style={{ color: S.textAccent, fontWeight: 700 }}>D{diff.position}</span>
        <span style={{ color: "#555" }}>·</span>
        <span style={{ color: S.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{diff.title}</span>
        <span style={{ color: S.textSuccess }}>+{diff.additions}</span>
        {diff.deletions > 0 && <span style={{ color: S.textError }}>-{diff.deletions}</span>}
        <span style={{ color: "#555" }}>·</span>
        <span style={{ color: S.textSecondary }}>{files.length} {files.length === 1 ? "file" : "files"}</span>
        <span style={{ color: "#555" }}>·</span>
        <span style={{ color: diff.status === "approved" || diff.status === "landed" ? S.textSuccess : diff.status === "submitted" ? S.textAccent : S.textSecondary }}>
          {diff.status}
        </span>
        <span style={{ color: "#555" }}>·</span>
        <button
          onClick={() => setThemeName(themeName === "vscode" ? "github" : "vscode")}
          style={{
            background: "transparent",
            border: `1px solid ${S.border}`,
            borderRadius: 3,
            padding: "2px 8px",
            color: S.textSecondary,
            cursor: "pointer",
            fontSize: "10px",
            fontFamily: S.font,
          }}
          title={`Switch to ${themeName === "vscode" ? "GitHub" : "VS Code"} theme`}
        >
          {themeName === "vscode" ? "GitHub theme" : "VS Code theme"}
        </button>
      </div>

      {/* ── Stack nav ── */}
      {siblingDiffs.length > 1 && (
        <div style={{ height: 28, display: "flex", alignItems: "center", padding: "0 12px", gap: 4, borderBottom: `1px solid ${S.border}`, background: S.bg, fontSize: "11px" }}>
          {siblingDiffs.map((d, i) => {
            const isCurrent = d.position === posNum;
            const icon = d.status === "approved" || d.status === "landed" ? "✓" : d.status === "submitted" ? "◑" : "○";
            const clr = d.status === "approved" || d.status === "landed" ? S.textSuccess : d.status === "submitted" ? S.textAccent : S.textSecondary;
            return (
              <span key={d.uuid} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                {i > 0 && <span style={{ color: "#444", margin: "0 2px" }}>→</span>}
                <Link
                  href={`/diffs/${slug}/${d.position}`}
                  style={{
                    padding: "1px 6px",
                    borderRadius: 3,
                    background: isCurrent ? "#37373d" : "transparent",
                    color: isCurrent ? S.textPrimary : S.textSecondary,
                    textDecoration: "none",
                  }}
                >
                  D{d.position}<span style={{ color: clr, marginLeft: 2 }}>{icon}</span>
                </Link>
              </span>
            );
          })}
          <span style={{ marginLeft: "auto", color: "#444" }}>n/p navigate</span>
        </div>
      )}

      {/* ── Scrollable diff area ── */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {files.map((file) => {
          const diffLines = file.diff ? parseDiff(file.diff) : [];

          return (
            <div key={file.path}>
              {/* File header — sticky */}
              <div style={{
                position: "sticky",
                top: 0,
                zIndex: 10,
                display: "flex",
                alignItems: "center",
                padding: "4px 12px",
                background: S.bgHeader,
                borderBottom: `1px solid ${S.border}`,
                borderTop: `1px solid ${S.border}`,
                fontSize: "12px",
              }}>
                <span style={{ color: S.textSecondary }}>
                  {file.path.split("/").slice(0, -1).join("/")}/
                </span>
                <span style={{ color: S.textPrimary, fontWeight: 600 }}>
                  {file.path.split("/").pop()}
                </span>
                <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <span style={{ color: S.textSuccess }}>+{file.additions}</span>
                  {file.deletions > 0 && <span style={{ color: S.textError }}>-{file.deletions}</span>}
                </span>
              </div>

              {/* Diff table */}
              {diffLines.length > 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: S.fontSize, lineHeight: S.lineHeight }}>
                  <colgroup>
                    <col style={{ width: 55 }} />
                    <col style={{ width: 55 }} />
                    <col />
                  </colgroup>
                  <tbody>
                    {diffLines.map((line, i) => {
                      if (line.type === "hunk") {
                        return (
                          <tr key={i}>
                            <td colSpan={3} style={{
                              padding: "4px 12px",
                              background: S.bgHunk,
                              color: S.textHunk,
                              fontSize: "12px",
                              borderTop: `1px solid #2a2a4a`,
                              borderBottom: `1px solid #2a2a4a`,
                            }}>
                              {line.content}
                            </td>
                          </tr>
                        );
                      }

                      const isAdd = line.type === "add";
                      const isDel = line.type === "del";
                      const rowBg = isAdd ? S.bgAdd : isDel ? S.bgDel : "transparent";
                      const gutterBg = isAdd ? S.bgAddGutter : isDel ? S.bgDelGutter : S.bgGutter;
                      const gutterColor = isAdd ? S.textGutterAdd : isDel ? S.textGutterDel : S.textGutter;

                      return (
                        <tr key={i} style={{ background: rowBg }}>
                          {/* Old line number */}
                          <td style={{
                            textAlign: "right",
                            padding: "0 8px 0 4px",
                            color: gutterColor,
                            background: gutterBg,
                            borderRight: `1px solid ${S.borderGutter}`,
                            userSelect: "none",
                            fontSize: "12px",
                            verticalAlign: "top",
                          }}>
                            {line.oldNum ?? ""}
                          </td>
                          {/* New line number */}
                          <td style={{
                            textAlign: "right",
                            padding: "0 8px 0 4px",
                            color: gutterColor,
                            background: gutterBg,
                            borderRight: `1px solid ${S.borderGutter}`,
                            userSelect: "none",
                            fontSize: "12px",
                            verticalAlign: "top",
                          }}>
                            {line.newNum ?? ""}
                          </td>
                          {/* Code content */}
                          <td style={{
                            padding: "0 12px",
                            whiteSpace: "pre",
                            fontFamily: S.font,
                            verticalAlign: "top",
                          }}>
                            <span style={{ color: isAdd ? "#6a9955" : isDel ? "#ce9178" : undefined, marginRight: 4, userSelect: "none" }}>
                              {isAdd ? "+" : isDel ? "-" : " "}
                            </span>
                            {highlightLine(line.content)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: "12px", color: S.textSecondary, fontSize: "12px" }}>
                  No diff content available
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
