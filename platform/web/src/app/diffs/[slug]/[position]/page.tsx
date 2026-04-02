"use client";

import { use, useEffect, useCallback, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useFeaturesDiffs } from "@/lib/hooks/use-diffs";
import dynamic from "next/dynamic";
import type { DiffFile } from "@/lib/types";

// Monaco loaded client-side only (it's heavy)
const DiffEditor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.DiffEditor),
  { ssr: false }
);

const Editor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.default),
  { ssr: false }
);

// ── API ──

async function fetchDiff(slug: string, position: number) {
  const res = await fetch(`/api/diffs/${slug}/${position}`);
  if (!res.ok) return null;
  return res.json();
}

async function fetchFileContent(sha: string, path: string): Promise<string> {
  try {
    const res = await fetch(`/api/git/file?sha=${sha}&path=${encodeURIComponent(path)}`);
    if (!res.ok) return "";
    const data = await res.json();
    return data.content || data || "";
  } catch {
    return "";
  }
}

// ── Language detection ──

function getLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    py: "python", go: "go", rs: "rust", rb: "ruby", java: "java",
    kt: "kotlin", swift: "swift", dart: "dart", cs: "csharp",
    cpp: "cpp", c: "c", h: "c", hpp: "cpp",
    json: "json", yaml: "yaml", yml: "yaml", toml: "toml",
    md: "markdown", html: "html", css: "css", scss: "scss",
    sql: "sql", sh: "shell", bash: "shell", zsh: "shell",
    dockerfile: "dockerfile", graphql: "graphql", proto: "protobuf",
    xml: "xml", svg: "xml",
  };
  return map[ext] || "plaintext";
}

// ── Component ──

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

  const { data: diff, isLoading } = useQuery({
    queryKey: ["diff-detail", slug, posNum],
    queryFn: () => fetchDiff(slug, posNum),
  });

  const files: DiffFile[] = useMemo(() => diff?.detailedFiles ?? diff?.files ?? [], [diff]);
  const [activeFileIdx, setActiveFileIdx] = useState(0);
  const activeFile = files[activeFileIdx];

  // Fetch original and modified file content for Monaco DiffEditor
  const parentSha = diff?.commit ? `${diff.commit}~1` : "";
  const currentSha = diff?.commit || "";

  const { data: originalContent } = useQuery({
    queryKey: ["file-content", parentSha, activeFile?.path],
    queryFn: () => fetchFileContent(parentSha, activeFile?.path || ""),
    enabled: !!parentSha && !!activeFile?.path,
  });

  const { data: modifiedContent } = useQuery({
    queryKey: ["file-content", currentSha, activeFile?.path],
    queryFn: () => fetchFileContent(currentSha, activeFile?.path || ""),
    enabled: !!currentSha && !!activeFile?.path,
  });

  const [viewMode, setViewMode] = useState<"side-by-side" | "inline">("inline");

  // Keyboard: n/p for stack, j/k for files
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "n") {
        if (siblingDiffs.find((d) => d.position === posNum + 1)) router.push(`/diffs/${slug}/${posNum + 1}`);
      } else if (e.key === "p" && posNum > 1) {
        if (siblingDiffs.find((d) => d.position === posNum - 1)) router.push(`/diffs/${slug}/${posNum - 1}`);
      } else if (e.key === "j") {
        setActiveFileIdx((i) => Math.min(i + 1, files.length - 1));
      } else if (e.key === "k") {
        setActiveFileIdx((i) => Math.max(i - 1, 0));
      }
    },
    [posNum, siblingDiffs, slug, router, files.length]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // ── Loading ──
  if (isLoading) {
    return (
      <div style={{ background: "#1e1e1e", color: "#666", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ width: 20, height: 20, border: "2px solid #333", borderTopColor: "#888", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // ── Not found ──
  if (!diff) {
    return (
      <div style={{ background: "#1e1e1e", color: "#888", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui", fontSize: 14 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ marginBottom: 16 }}>D{position} not found in {slug}</div>
          <Link href={`/diffs/${slug}`} style={{ color: "#569cd6" }}>← Back</Link>
        </div>
      </div>
    );
  }

  const lang = activeFile ? getLanguage(activeFile.path) : "plaintext";

  return (
    <div style={{ background: "#1e1e1e", color: "#d4d4d4", height: "100vh", display: "flex", flexDirection: "column" }}>

      {/* ── Header bar (36px) ── */}
      <div style={{
        height: 36, display: "flex", alignItems: "center", padding: "0 12px", gap: 8,
        borderBottom: "1px solid #2d2d2d", background: "#252526",
        fontSize: 12, fontFamily: "'Segoe UI', system-ui, sans-serif", flexShrink: 0,
      }}>
        <Link href={`/diffs/${slug}`} style={{ color: "#858585", textDecoration: "none" }}>
          ← {parentFeature?.feature.name || slug}
        </Link>
        <span style={{ color: "#444" }}>·</span>
        <span style={{ color: "#569cd6", fontWeight: 700 }}>D{diff.position}</span>
        <span style={{ color: "#444" }}>·</span>
        <span style={{ color: "#d4d4d4", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {diff.title}
        </span>
        <span style={{ color: "#4ec9b0" }}>+{diff.additions}</span>
        {diff.deletions > 0 && <span style={{ color: "#f44747" }}>-{diff.deletions}</span>}
        <span style={{ color: "#444" }}>·</span>
        <span style={{ color: diff.status === "approved" || diff.status === "landed" ? "#4ec9b0" : diff.status === "submitted" ? "#569cd6" : "#858585" }}>
          {diff.status}
        </span>
        <span style={{ color: "#444" }}>·</span>
        <button
          onClick={() => setViewMode(viewMode === "inline" ? "side-by-side" : "inline")}
          style={{ background: "#333", border: "1px solid #444", borderRadius: 3, padding: "2px 8px", color: "#ccc", cursor: "pointer", fontSize: 10, fontFamily: "inherit" }}
        >
          {viewMode === "inline" ? "Side by side" : "Inline"}
        </button>
      </div>

      {/* ── Stack nav (28px) ── */}
      {siblingDiffs.length > 1 && (
        <div style={{
          height: 28, display: "flex", alignItems: "center", padding: "0 12px", gap: 4,
          borderBottom: "1px solid #2d2d2d", background: "#1e1e1e",
          fontSize: 11, fontFamily: "'SF Mono', Menlo, monospace",
        }}>
          {siblingDiffs.map((d, i) => {
            const isCurrent = d.position === posNum;
            const icon = d.status === "approved" || d.status === "landed" ? "✓" : d.status === "submitted" ? "◑" : "○";
            const clr = d.status === "approved" || d.status === "landed" ? "#4ec9b0" : d.status === "submitted" ? "#569cd6" : "#858585";
            return (
              <span key={d.uuid} style={{ display: "flex", alignItems: "center" }}>
                {i > 0 && <span style={{ color: "#333", margin: "0 3px" }}>→</span>}
                <Link
                  href={`/diffs/${slug}/${d.position}`}
                  style={{
                    padding: "1px 6px", borderRadius: 3, textDecoration: "none",
                    background: isCurrent ? "#37373d" : "transparent",
                    color: isCurrent ? "#d4d4d4" : "#858585",
                  }}
                >
                  D{d.position}<span style={{ color: clr, marginLeft: 2 }}>{icon}</span>
                </Link>
              </span>
            );
          })}
          <span style={{ marginLeft: "auto", color: "#333", fontSize: 10 }}>n/p diffs · j/k files</span>
        </div>
      )}

      {/* ── File tabs ── */}
      {files.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 0,
          borderBottom: "1px solid #2d2d2d", background: "#252526",
          overflow: "auto", flexShrink: 0,
        }}>
          {files.map((f, i) => {
            const isActive = i === activeFileIdx;
            const filename = f.path.split("/").pop();
            return (
              <button
                key={f.path}
                onClick={() => setActiveFileIdx(i)}
                style={{
                  padding: "6px 16px", border: "none", cursor: "pointer",
                  fontFamily: "'SF Mono', Menlo, monospace", fontSize: 11,
                  background: isActive ? "#1e1e1e" : "transparent",
                  color: isActive ? "#d4d4d4" : "#858585",
                  borderBottom: isActive ? "2px solid #569cd6" : "2px solid transparent",
                  borderRight: "1px solid #2d2d2d",
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ color: f.status === "added" ? "#4ec9b0" : f.status === "deleted" ? "#f44747" : "#d4d4d4" }}>
                  {filename}
                </span>
                <span style={{ marginLeft: 6, fontSize: 10, color: "#4ec9b0" }}>+{f.additions}</span>
                {f.deletions > 0 && <span style={{ fontSize: 10, color: "#f44747" }}>-{f.deletions}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Monaco Diff Editor ── */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {activeFile && originalContent !== undefined && modifiedContent !== undefined ? (
          viewMode === "side-by-side" ? (
            <DiffEditor
              original={originalContent || ""}
              modified={modifiedContent || ""}
              language={lang}
              theme="vs-dark"
              options={{
                readOnly: true,
                renderSideBySide: true,
                minimap: { enabled: false },
                fontSize: 13,
                lineHeight: 20,
                scrollBeyondLastLine: false,
                renderOverviewRuler: false,
                overviewRulerBorder: false,
                scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
                padding: { top: 8, bottom: 8 },
              }}
            />
          ) : (
            <DiffEditor
              original={originalContent || ""}
              modified={modifiedContent || ""}
              language={lang}
              theme="vs-dark"
              options={{
                readOnly: true,
                renderSideBySide: false,
                minimap: { enabled: false },
                fontSize: 13,
                lineHeight: 20,
                scrollBeyondLastLine: false,
                renderOverviewRuler: false,
                overviewRulerBorder: false,
                scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
                padding: { top: 8, bottom: 8 },
              }}
            />
          )
        ) : activeFile ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#555", fontSize: 12 }}>
            Loading file content...
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#555", fontSize: 12 }}>
            No files in this diff
          </div>
        )}
      </div>
    </div>
  );
}
