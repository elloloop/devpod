"use client";

import { use, useEffect, useCallback, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useFeaturesDiffs } from "@/lib/hooks/use-diffs";
import dynamic from "next/dynamic";
import type { DiffFile } from "@/lib/types";

const DiffEditor = dynamic(() => import("@monaco-editor/react").then((m) => m.DiffEditor), { ssr: false });

// ── Types ──

type ColorMode = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface Theme {
  bg: string;
  bgSecondary: string;
  bgTertiary: string;
  bgHover: string;
  bgActive: string;
  border: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  success: string;
  error: string;
  info: string;
  monacoTheme: string;
  statusBar: string;
  statusBarText: string;
}

const THEMES: Record<ResolvedTheme, Theme> = {
  dark: {
    bg: "#1e1e1e",
    bgSecondary: "#252526",
    bgTertiary: "#2d2d2d",
    bgHover: "#2a2d2e",
    bgActive: "#37373d",
    border: "#3c3c3c",
    text: "#cccccc",
    textSecondary: "#969696",
    textTertiary: "#5a5a5a",
    accent: "#0078d4",
    success: "#89d185",
    error: "#f48771",
    info: "#75beff",
    monacoTheme: "vs-dark",
    statusBar: "#007acc",
    statusBarText: "#ffffff",
  },
  light: {
    bg: "#ffffff",
    bgSecondary: "#f3f3f3",
    bgTertiary: "#e8e8e8",
    bgHover: "#e8e8e8",
    bgActive: "#d6d6d6",
    border: "#e5e5e5",
    text: "#333333",
    textSecondary: "#616161",
    textTertiary: "#a0a0a0",
    accent: "#0078d4",
    success: "#388a34",
    error: "#cd3131",
    info: "#0066bf",
    monacoTheme: "light",
    statusBar: "#0078d4",
    statusBarText: "#ffffff",
  },
};

// ── Helpers ──

function useColorMode(): [ResolvedTheme, ColorMode, (m: ColorMode) => void] {
  const [mode, setModeState] = useState<ColorMode>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>("dark");

  useEffect(() => {
    const saved = localStorage.getItem("devpod-color-mode") as ColorMode | null;
    if (saved) setModeState(saved);
  }, []);

  useEffect(() => {
    if (mode === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      setResolved(mq.matches ? "dark" : "light");
      const handler = (e: MediaQueryListEvent) => setResolved(e.matches ? "dark" : "light");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
    setResolved(mode as ResolvedTheme);
  }, [mode]);

  const setMode = useCallback((m: ColorMode) => {
    setModeState(m);
    localStorage.setItem("devpod-color-mode", m);
  }, []);

  return [resolved, mode, setMode];
}

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
    return data.content || "";
  } catch {
    return "";
  }
}

function getLang(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const m: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    py: "python", go: "go", rs: "rust", rb: "ruby", java: "java", swift: "swift",
    json: "json", yaml: "yaml", yml: "yaml", md: "markdown", html: "html",
    css: "css", scss: "scss", sql: "sql", sh: "shell", bash: "shell",
    dockerfile: "dockerfile", proto: "protobuf", xml: "xml",
  };
  return m[ext] || "plaintext";
}

function fileIcon(status: string): string {
  if (status === "added") return "🟢";
  if (status === "deleted") return "🔴";
  return "🟡";
}

// ── SVG Icons (inline, no deps) ──

function SunIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 12a4 4 0 100-8 4 4 0 000 8zm0-1.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5zM8 0a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0V.75A.75.75 0 018 0zm0 12a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 018 12zM2.343 2.343a.75.75 0 011.061 0l1.06 1.061a.75.75 0 01-1.06 1.06L2.343 3.404a.75.75 0 010-1.06zm8.486 8.485a.75.75 0 011.06 0l1.061 1.061a.75.75 0 01-1.06 1.06l-1.06-1.06a.75.75 0 010-1.06zM0 8a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5H.75A.75.75 0 010 8zm12 0a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5A.75.75 0 0112 8zM2.343 13.657a.75.75 0 010-1.06l1.06-1.061a.75.75 0 111.061 1.06l-1.06 1.061a.75.75 0 01-1.061 0zm8.486-8.486a.75.75 0 010-1.06l1.06-1.061a.75.75 0 111.061 1.06l-1.06 1.06a.75.75 0 01-1.061 0z"/></svg>;
}

function MoonIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" d="M9.598 1.591a.75.75 0 01.785-.175 7 7 0 11-8.967 8.967.75.75 0 01.961-.96A5.5 5.5 0 009.598 1.59z"/></svg>;
}

function MonitorIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1.5 2A1.5 1.5 0 000 3.5v7A1.5 1.5 0 001.5 12H6v1.5H4.75a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5H10V12h4.5a1.5 1.5 0 001.5-1.5v-7A1.5 1.5 0 0014.5 2h-13zm0 1.5h13v7h-13v-7z"/></svg>;
}

// ── Component ──

export default function DiffReviewPage({ params }: { params: Promise<{ slug: string; position: string }> }) {
  const { slug, position } = use(params);
  const posNum = parseInt(position, 10);
  const router = useRouter();
  const [resolved, colorMode, setColorMode] = useColorMode();
  const t = THEMES[resolved];

  const { data: allFeatures } = useFeaturesDiffs();
  const parentFeature = allFeatures?.find((f) => f.feature.slug === slug);
  const siblingDiffs = parentFeature?.diffs ?? [];

  const { data: diff, isLoading } = useQuery({
    queryKey: ["diff-detail", slug, posNum],
    queryFn: () => fetchDiff(slug, posNum),
  });

  const files: DiffFile[] = useMemo(() => diff?.detailedFiles ?? diff?.files ?? [], [diff]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [renderSideBySide, setRenderSideBySide] = useState(true);
  const activeFile = files[activeIdx];

  const parentSha = diff?.commit ? `${diff.commit}~1` : "";
  const currentSha = diff?.commit || "";

  const { data: original } = useQuery({
    queryKey: ["fc", parentSha, activeFile?.path],
    queryFn: () => fetchFileContent(parentSha, activeFile?.path || ""),
    enabled: !!parentSha && !!activeFile?.path,
  });
  const { data: modified } = useQuery({
    queryKey: ["fc", currentSha, activeFile?.path],
    queryFn: () => fetchFileContent(currentSha, activeFile?.path || ""),
    enabled: !!currentSha && !!activeFile?.path,
  });

  // Keyboard
  const onKey = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === "n") { const nx = siblingDiffs.find(d => d.position === posNum + 1); if (nx) router.push(`/diffs/${slug}/${posNum + 1}`); }
    else if (e.key === "p" && posNum > 1) { const pr = siblingDiffs.find(d => d.position === posNum - 1); if (pr) router.push(`/diffs/${slug}/${posNum - 1}`); }
    else if (e.key === "j") setActiveIdx(i => Math.min(i + 1, files.length - 1));
    else if (e.key === "k") setActiveIdx(i => Math.max(i - 1, 0));
    else if (e.key === "b") setSidebarOpen(s => !s);
  }, [posNum, siblingDiffs, slug, router, files.length]);

  useEffect(() => { window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [onKey]);

  // ── Loading / Error ──
  if (isLoading) return <div style={{ background: t.bg, height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ color: t.textTertiary, fontSize: 13 }}>Loading...</div></div>;
  if (!diff) return <div style={{ background: t.bg, height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}><div style={{ color: t.textSecondary, fontSize: 13 }}>D{position} not found</div><Link href={`/diffs/${slug}`} style={{ color: t.accent, fontSize: 12 }}>← Back</Link></div>;

  const lang = activeFile ? getLang(activeFile.path) : "plaintext";

  return (
    <div style={{ background: t.bg, color: t.text, height: "100vh", display: "flex", flexDirection: "column", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontSize: 13, overflow: "hidden" }}>

      {/* ════════ TITLE BAR ════════ */}
      <div style={{ height: 35, display: "flex", alignItems: "center", padding: "0 10px", gap: 6, background: t.bgTertiary, borderBottom: `1px solid ${t.border}`, flexShrink: 0, fontSize: 12, WebkitAppRegion: "drag" } as React.CSSProperties}>
        <Link href={`/diffs/${slug}`} style={{ color: t.textSecondary, textDecoration: "none", WebkitAppRegion: "no-drag" } as React.CSSProperties}>
          ←
        </Link>
        <span style={{ color: t.textSecondary }}>{parentFeature?.feature.name || slug}</span>
        <span style={{ color: t.textTertiary }}>›</span>
        <span style={{ color: t.accent, fontWeight: 600 }}>D{diff.position}</span>
        <span style={{ color: t.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{diff.title}</span>

        {/* View toggle */}
        <button onClick={() => setRenderSideBySide(!renderSideBySide)} style={{ ...btnStyle(t), WebkitAppRegion: "no-drag" } as React.CSSProperties}>
          {renderSideBySide ? "Inline" : "Split"}
        </button>

        {/* Theme toggle */}
        <div style={{ display: "flex", gap: 1, background: t.bgSecondary, borderRadius: 4, padding: 1, WebkitAppRegion: "no-drag" } as React.CSSProperties}>
          {(["light", "dark", "system"] as ColorMode[]).map(m => (
            <button key={m} onClick={() => setColorMode(m)} style={{ ...themeBtnStyle(t, colorMode === m) }} title={m}>
              {m === "light" ? <SunIcon /> : m === "dark" ? <MoonIcon /> : <MonitorIcon />}
            </button>
          ))}
        </div>
      </div>

      {/* ════════ STACK NAV ════════ */}
      {siblingDiffs.length > 1 && (
        <div style={{ height: 26, display: "flex", alignItems: "center", padding: "0 10px", gap: 2, borderBottom: `1px solid ${t.border}`, background: t.bg, fontSize: 11, fontFamily: "'SF Mono', Menlo, monospace", flexShrink: 0 }}>
          {siblingDiffs.map((d, i) => {
            const cur = d.position === posNum;
            const ico = d.status === "approved" || d.status === "landed" ? "✓" : d.status === "submitted" ? "◑" : "○";
            const clr = d.status === "approved" || d.status === "landed" ? t.success : d.status === "submitted" ? t.info : t.textTertiary;
            return (
              <span key={d.uuid} style={{ display: "flex", alignItems: "center" }}>
                {i > 0 && <span style={{ color: t.textTertiary, margin: "0 3px", fontSize: 9 }}>→</span>}
                <Link href={`/diffs/${slug}/${d.position}`} style={{ padding: "1px 5px", borderRadius: 3, background: cur ? t.bgActive : "transparent", color: cur ? t.text : t.textSecondary, textDecoration: "none", fontSize: 11 }}>
                  D{d.position}<span style={{ color: clr, marginLeft: 2 }}>{ico}</span>
                </Link>
              </span>
            );
          })}
          <span style={{ marginLeft: "auto", color: t.textTertiary, fontSize: 10 }}>n/p diffs · j/k files · b sidebar</span>
        </div>
      )}

      {/* ════════ MAIN AREA ════════ */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── File sidebar ── */}
        {sidebarOpen && (
          <div style={{ width: 220, borderRight: `1px solid ${t.border}`, background: t.bgSecondary, overflow: "auto", flexShrink: 0 }}>
            <div style={{ padding: "8px 10px", fontSize: 11, fontWeight: 600, color: t.textSecondary, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Files ({files.length})
            </div>
            {files.map((f, i) => {
              const active = i === activeIdx;
              const fname = f.path.split("/").pop() || f.path;
              const dir = f.path.split("/").slice(0, -1).join("/");
              return (
                <div
                  key={f.path}
                  onClick={() => setActiveIdx(i)}
                  style={{
                    padding: "4px 10px",
                    cursor: "pointer",
                    background: active ? t.bgActive : "transparent",
                    borderLeft: active ? `2px solid ${t.accent}` : "2px solid transparent",
                    fontSize: 12,
                    fontFamily: "'SF Mono', Menlo, monospace",
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget.style.background = t.bgHover); }}
                  onMouseLeave={e => { if (!active) (e.currentTarget.style.background = "transparent"); }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 10 }}>{fileIcon(f.status)}</span>
                    <span style={{ color: active ? t.text : t.textSecondary }}>{fname}</span>
                    <span style={{ marginLeft: "auto", fontSize: 10 }}>
                      <span style={{ color: t.success }}>+{f.additions}</span>
                      {f.deletions > 0 && <span style={{ color: t.error }}>-{f.deletions}</span>}
                    </span>
                  </div>
                  {dir && <div style={{ fontSize: 10, color: t.textTertiary, marginTop: 1, paddingLeft: 18 }}>{dir}</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Editor area ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Tab bar */}
          {activeFile && (
            <div style={{ height: 35, display: "flex", alignItems: "center", background: t.bgSecondary, borderBottom: `1px solid ${t.border}`, flexShrink: 0, overflow: "auto" }}>
              {files.map((f, i) => {
                const active = i === activeIdx;
                const fname = f.path.split("/").pop() || f.path;
                return (
                  <div
                    key={f.path}
                    onClick={() => setActiveIdx(i)}
                    style={{
                      padding: "0 12px", height: "100%", display: "flex", alignItems: "center", gap: 4,
                      cursor: "pointer", fontSize: 12,
                      fontFamily: "'SF Mono', Menlo, monospace",
                      background: active ? t.bg : "transparent",
                      color: active ? t.text : t.textSecondary,
                      borderRight: `1px solid ${t.border}`,
                      borderBottom: active ? `1px solid ${t.bg}` : "none",
                      marginBottom: active ? -1 : 0,
                    }}
                  >
                    <span style={{ fontSize: 9 }}>{fileIcon(f.status)}</span>
                    {fname}
                  </div>
                );
              })}
            </div>
          )}

          {/* Monaco */}
          <div style={{ flex: 1 }}>
            {activeFile && original !== undefined && modified !== undefined ? (
              <DiffEditor
                original={original || ""}
                modified={modified || ""}
                language={lang}
                theme={t.monacoTheme}
                options={{
                  readOnly: true,
                  renderSideBySide,
                  minimap: { enabled: true, scale: 1, showSlider: "mouseover" },
                  fontSize: 13,
                  lineHeight: 20,
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, monospace",
                  fontLigatures: true,
                  scrollBeyondLastLine: false,
                  renderOverviewRuler: true,
                  scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
                  padding: { top: 8, bottom: 8 },
                  renderWhitespace: "selection",
                  bracketPairColorization: { enabled: true },
                  guides: { indentation: true },
                  smoothScrolling: true,
                  cursorBlinking: "smooth",
                }}
              />
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: t.textTertiary, fontSize: 12 }}>
                {activeFile ? "Loading..." : "Select a file"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ════════ STATUS BAR ════════ */}
      <div style={{ height: 22, display: "flex", alignItems: "center", padding: "0 10px", gap: 12, background: t.statusBar, color: t.statusBarText, fontSize: 11, flexShrink: 0, fontFamily: "'SF Mono', Menlo, monospace" }}>
        <span>{parentFeature?.feature.name}</span>
        <span>D{diff.position} of {siblingDiffs.length || "?"}</span>
        {activeFile && <span>{activeFile.path}</span>}
        <span style={{ marginLeft: "auto" }}>
          +{diff.additions} -{diff.deletions}
        </span>
        <span>{diff.status}</span>
        <span>{files.length} {files.length === 1 ? "file" : "files"}</span>
      </div>
    </div>
  );
}

// ── Shared styles ──

function btnStyle(t: Theme): React.CSSProperties {
  return { background: "transparent", border: `1px solid ${t.border}`, borderRadius: 3, padding: "2px 8px", color: t.textSecondary, cursor: "pointer", fontSize: 11, fontFamily: "inherit" };
}

function themeBtnStyle(t: Theme, active: boolean): React.CSSProperties {
  return { background: active ? t.bgActive : "transparent", border: "none", borderRadius: 3, padding: "3px 6px", color: active ? t.text : t.textTertiary, cursor: "pointer", display: "flex", alignItems: "center" };
}
