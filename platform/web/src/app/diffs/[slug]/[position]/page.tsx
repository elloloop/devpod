"use client";

import { use, useEffect, useCallback, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useFeaturesDiffs } from "@/lib/hooks/use-diffs";
import dynamic from "next/dynamic";
import type { DiffFile } from "@/lib/types";

const DiffEditor = dynamic(() => import("@monaco-editor/react").then((m) => m.DiffEditor), { ssr: false });

// ── Helpers ──

/**
 * Read the current Monaco theme from the CSS variable set by theme.js.
 * Falls back to "vs-dark" on SSR / initial render.
 */
function useMonacoTheme(): string {
  const [theme, setTheme] = useState("vs-dark");

  useEffect(() => {
    function read() {
      const raw = getComputedStyle(document.documentElement)
        .getPropertyValue("--dp-monaco-theme")
        .trim()
        .replace(/['"]/g, "");
      if (raw) setTheme(raw);
    }
    read();
    // Listen for theme changes dispatched by theme.js
    window.addEventListener("devpod-theme-change", read);
    return () => window.removeEventListener("devpod-theme-change", read);
  }, []);

  return theme;
}

/**
 * Provide mode / scheme controls that delegate to the global DevpodTheme API
 * loaded via theme.js (in layout.tsx <Script>).
 */
function useDevpodTheme() {
  const [mode, setModeState] = useState("dark");
  const [scheme, setSchemeState] = useState("linear");

  useEffect(() => {
    function sync() {
      const w = window as unknown as { DevpodTheme?: { getMode: () => string; getScheme: () => string } };
      if (w.DevpodTheme) {
        setModeState(w.DevpodTheme.getMode());
        setSchemeState(w.DevpodTheme.getScheme());
      }
    }
    sync();
    window.addEventListener("devpod-theme-change", sync);
    return () => window.removeEventListener("devpod-theme-change", sync);
  }, []);

  const setMode = useCallback((m: string) => {
    const w = window as unknown as { DevpodTheme?: { setMode: (m: string) => void } };
    if (w.DevpodTheme) w.DevpodTheme.setMode(m);
    setModeState(m);
  }, []);

  const setScheme = useCallback((s: string) => {
    const w = window as unknown as { DevpodTheme?: { setScheme: (s: string) => void } };
    if (w.DevpodTheme) w.DevpodTheme.setScheme(s);
    setSchemeState(s);
  }, []);

  return { mode, scheme, setMode, setScheme };
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
  if (status === "added") return "\uD83D\uDFE2";
  if (status === "deleted") return "\uD83D\uDD34";
  return "\uD83D\uDFE1";
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

// ── Scheme picker dots ──

const SCHEME_META: { key: string; label: string; color: string }[] = [
  { key: "linear", label: "Lin", color: "#818cf8" },
  { key: "github", label: "GH", color: "#58a6ff" },
  { key: "retro", label: "Ret", color: "#fbbf24" },
  { key: "midnight", label: "Mid", color: "#22d3ee" },
  { key: "rose", label: "Ros", color: "#eb6f92" },
];

// ── Component ──

export default function DiffReviewPage({ params }: { params: Promise<{ slug: string; position: string }> }) {
  const { slug, position } = use(params);
  const posNum = parseInt(position, 10);
  const router = useRouter();
  const monacoTheme = useMonacoTheme();
  const { mode, scheme, setMode, setScheme } = useDevpodTheme();

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
  if (isLoading) return (
    <div className="dp-diff-loading">
      <div style={{ color: "var(--dp-text-tertiary)", fontSize: 13 }}>Loading...</div>
    </div>
  );
  if (!diff) return (
    <div className="dp-diff-loading" style={{ flexDirection: "column", gap: 12 }}>
      <div style={{ color: "var(--dp-text-secondary)", fontSize: 13 }}>D{position} not found</div>
      <Link href={`/diffs/${slug}`} style={{ color: "var(--dp-accent)", fontSize: 12 }}>&larr; Back</Link>
    </div>
  );

  const lang = activeFile ? getLang(activeFile.path) : "plaintext";

  return (
    <>
      <style>{`
        .dp-diff-loading {
          background: var(--dp-bg);
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .dp-diff-root {
          background: var(--dp-bg);
          color: var(--dp-text);
          height: 100vh;
          display: flex;
          flex-direction: column;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 13px;
          overflow: hidden;
        }
        .dp-titlebar {
          height: 35px;
          display: flex;
          align-items: center;
          padding: 0 10px;
          gap: 6px;
          background: var(--dp-bg-tertiary);
          border-bottom: var(--dp-border-width, 1px) solid var(--dp-border);
          flex-shrink: 0;
          font-size: 12px;
        }
        .dp-stacknav {
          height: 26px;
          display: flex;
          align-items: center;
          padding: 0 10px;
          gap: 2px;
          border-bottom: var(--dp-border-width, 1px) solid var(--dp-border);
          background: var(--dp-bg);
          font-size: 11px;
          font-family: 'SF Mono', Menlo, monospace;
          flex-shrink: 0;
        }
        .dp-sidebar {
          width: 220px;
          border-right: var(--dp-border-width, 1px) solid var(--dp-border);
          background: var(--dp-bg-secondary);
          overflow: auto;
          flex-shrink: 0;
        }
        .dp-sidebar-item {
          padding: 4px 10px;
          cursor: pointer;
          font-size: 12px;
          font-family: 'SF Mono', Menlo, monospace;
        }
        .dp-sidebar-item:hover {
          background: var(--dp-bg-hover);
        }
        .dp-tabbar {
          height: 35px;
          display: flex;
          align-items: center;
          background: var(--dp-bg-secondary);
          border-bottom: var(--dp-border-width, 1px) solid var(--dp-border);
          flex-shrink: 0;
          overflow: auto;
        }
        .dp-tab {
          padding: 0 12px;
          height: 100%;
          display: flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          font-size: 12px;
          font-family: 'SF Mono', Menlo, monospace;
          border-right: var(--dp-border-width, 1px) solid var(--dp-border);
          color: var(--dp-text-secondary);
        }
        .dp-tab-active {
          background: var(--dp-bg);
          color: var(--dp-text);
          border-bottom: 1px solid var(--dp-bg);
          margin-bottom: -1px;
        }
        .dp-statusbar {
          height: 22px;
          display: flex;
          align-items: center;
          padding: 0 10px;
          gap: 12px;
          background: var(--dp-statusbar);
          color: var(--dp-statusbar-text);
          font-size: 11px;
          flex-shrink: 0;
          font-family: 'SF Mono', Menlo, monospace;
        }
        .dp-btn {
          background: transparent;
          border: var(--dp-border-width, 1px) solid var(--dp-border);
          border-radius: var(--dp-radius, 4px);
          padding: 2px 8px;
          color: var(--dp-text-secondary);
          cursor: pointer;
          font-size: 11px;
          font-family: inherit;
        }
        .dp-btn:hover {
          border-color: var(--dp-accent);
          color: var(--dp-text);
        }
        .dp-mode-group {
          display: flex;
          gap: 1px;
          background: var(--dp-bg-secondary);
          border-radius: 4px;
          padding: 1px;
        }
        .dp-mode-btn {
          background: transparent;
          border: none;
          border-radius: 3px;
          padding: 3px 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          color: var(--dp-text-tertiary);
        }
        .dp-mode-btn-active {
          background: var(--dp-bg-active);
          color: var(--dp-text);
        }
        .dp-scheme-btn {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 2px solid transparent;
          cursor: pointer;
          transition: border-color 0.15s;
          padding: 0;
        }
        .dp-scheme-btn-active {
          border-color: var(--dp-text);
        }
      `}</style>

      <div className="dp-diff-root">

        {/* ════ TITLE BAR ════ */}
        <div className="dp-titlebar">
          <Link href={`/diffs/${slug}`} style={{ color: "var(--dp-text-secondary)", textDecoration: "none" }}>
            &larr;
          </Link>
          <span style={{ color: "var(--dp-text-secondary)" }}>{parentFeature?.feature.name || slug}</span>
          <span style={{ color: "var(--dp-text-tertiary)" }}>&rsaquo;</span>
          <span style={{ color: "var(--dp-accent)", fontWeight: 600 }}>D{diff.position}</span>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{diff.title}</span>

          {/* View toggle */}
          <button onClick={() => setRenderSideBySide(!renderSideBySide)} className="dp-btn">
            {renderSideBySide ? "Inline" : "Split"}
          </button>

          {/* Scheme dots */}
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {SCHEME_META.map(s => (
              <button
                key={s.key}
                className={`dp-scheme-btn ${scheme === s.key ? "dp-scheme-btn-active" : ""}`}
                style={{ background: s.color }}
                onClick={() => setScheme(s.key)}
                title={s.label}
              />
            ))}
          </div>

          {/* Mode toggle */}
          <div className="dp-mode-group">
            {(["light", "dark", "system"] as const).map(m => (
              <button key={m} onClick={() => setMode(m)} className={`dp-mode-btn ${mode === m ? "dp-mode-btn-active" : ""}`} title={m}>
                {m === "light" ? <SunIcon /> : m === "dark" ? <MoonIcon /> : <MonitorIcon />}
              </button>
            ))}
          </div>
        </div>

        {/* ════ STACK NAV ════ */}
        {siblingDiffs.length > 1 && (
          <div className="dp-stacknav">
            {siblingDiffs.map((d, i) => {
              const cur = d.position === posNum;
              const ico = d.status === "approved" || d.status === "landed" ? "\u2713" : d.status === "submitted" ? "\u25D1" : "\u25CB";
              const clr = d.status === "approved" || d.status === "landed" ? "var(--dp-success)" : d.status === "submitted" ? "var(--dp-info)" : "var(--dp-text-tertiary)";
              return (
                <span key={d.uuid} style={{ display: "flex", alignItems: "center" }}>
                  {i > 0 && <span style={{ color: "var(--dp-text-tertiary)", margin: "0 3px", fontSize: 9 }}>&rarr;</span>}
                  <Link href={`/diffs/${slug}/${d.position}`} style={{ padding: "1px 5px", borderRadius: 3, background: cur ? "var(--dp-bg-active)" : "transparent", color: cur ? "var(--dp-text)" : "var(--dp-text-secondary)", textDecoration: "none", fontSize: 11 }}>
                    D{d.position}<span style={{ color: clr, marginLeft: 2 }}>{ico}</span>
                  </Link>
                </span>
              );
            })}
            <span style={{ marginLeft: "auto", color: "var(--dp-text-tertiary)", fontSize: 10 }}>n/p diffs &middot; j/k files &middot; b sidebar</span>
          </div>
        )}

        {/* ════ MAIN AREA ════ */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* File sidebar */}
          {sidebarOpen && (
            <div className="dp-sidebar">
              <div style={{ padding: "8px 10px", fontSize: 11, fontWeight: 600, color: "var(--dp-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
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
                    className="dp-sidebar-item"
                    style={{
                      background: active ? "var(--dp-bg-active)" : undefined,
                      borderLeft: active ? "2px solid var(--dp-accent)" : "2px solid transparent",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 10 }}>{fileIcon(f.status)}</span>
                      <span style={{ color: active ? "var(--dp-text)" : "var(--dp-text-secondary)" }}>{fname}</span>
                      <span style={{ marginLeft: "auto", fontSize: 10 }}>
                        <span style={{ color: "var(--dp-success)" }}>+{f.additions}</span>
                        {f.deletions > 0 && <span style={{ color: "var(--dp-error)" }}>-{f.deletions}</span>}
                      </span>
                    </div>
                    {dir && <div style={{ fontSize: 10, color: "var(--dp-text-tertiary)", marginTop: 1, paddingLeft: 18 }}>{dir}</div>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Editor area */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Tab bar */}
            {activeFile && (
              <div className="dp-tabbar">
                {files.map((f, i) => {
                  const active = i === activeIdx;
                  const fname = f.path.split("/").pop() || f.path;
                  return (
                    <div
                      key={f.path}
                      onClick={() => setActiveIdx(i)}
                      className={`dp-tab ${active ? "dp-tab-active" : ""}`}
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
                  theme={monacoTheme}
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
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--dp-text-tertiary)", fontSize: 12 }}>
                  {activeFile ? "Loading..." : "Select a file"}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ════ STATUS BAR ════ */}
        <div className="dp-statusbar">
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
    </>
  );
}
