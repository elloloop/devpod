"use client";

import { useState, useRef, useEffect, useCallback, useMemo, forwardRef } from 'react';
import { parseUnifiedDiff } from '@/packages/diff-engine';
import type { DiffFile, DiffHunk } from '@/packages/diff-engine';
import { useReviewComments } from '@/packages/review';
import type { InlineComment } from '@/packages/review';

interface DiffTableProps {
  files: DiffFile[];
  reviewKey: string;
  onFileClick?: (path: string) => void;
}

export function DiffTable({ files, reviewKey, onFileClick }: DiffTableProps) {
  const [activeFile, setActiveFile] = useState<string>('');
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(() => {
    const generated = new Set<string>();
    for (const f of files) {
      if (f.isGenerated) generated.add(f.path);
    }
    return generated;
  });
  const { comments, addComment, removeComment } = useReviewComments(reviewKey);
  const [commentingOn, setCommentingOn] = useState<{
    filePath: string;
    lineNumber: number;
    lineType: 'old' | 'new';
  } | null>(null);
  const [commentText, setCommentText] = useState('');

  const fileRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Keyboard: j/k for files
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const currentIdx = files.findIndex((f) => f.path === activeFile);
      if (e.key === 'j') {
        e.preventDefault();
        const nextIdx = Math.min(currentIdx + 1, files.length - 1);
        scrollToFile(files[nextIdx].path);
      } else if (e.key === 'k') {
        e.preventDefault();
        const prevIdx = Math.max(currentIdx - 1, 0);
        scrollToFile(files[prevIdx].path);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFile, files]);

  // Scroll spy
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const path = entry.target.getAttribute('data-file-path');
            if (path) setActiveFile(path);
          }
        }
      },
      { rootMargin: '-40px 0px -80% 0px', threshold: 0 }
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
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  const submitComment = useCallback(() => {
    if (!commentingOn || !commentText.trim()) return;
    addComment({
      filePath: commentingOn.filePath,
      lineNumber: commentingOn.lineNumber,
      lineType: commentingOn.lineType,
      text: commentText.trim(),
    });
    setCommentingOn(null);
    setCommentText('');
  }, [commentingOn, commentText, addComment]);

  return (
    <div>
      {files.map((file) => (
        <FileDiffSection
          key={file.path}
          file={file}
          isCollapsed={collapsedFiles.has(file.path)}
          onToggle={() => toggleFile(file.path)}
          onLineClick={(lineNumber, lineType) =>
            setCommentingOn({ filePath: file.path, lineNumber, lineType })
          }
          comments={comments.filter((c) => c.filePath === file.path)}
          commentingOn={commentingOn?.filePath === file.path ? commentingOn : null}
          commentText={commentText}
          onCommentTextChange={setCommentText}
          onSubmitComment={submitComment}
          onCancelComment={() => { setCommentingOn(null); setCommentText(''); }}
          onDeleteComment={removeComment}
          ref={(el) => {
            if (el) fileRefs.current.set(file.path, el);
            else fileRefs.current.delete(file.path);
          }}
        />
      ))}
    </div>
  );
}

// --- File diff section ---

interface FileDiffSectionProps {
  file: DiffFile;
  isCollapsed: boolean;
  onToggle: () => void;
  onLineClick: (lineNumber: number, lineType: 'old' | 'new') => void;
  comments: InlineComment[];
  commentingOn: { lineNumber: number; lineType: 'old' | 'new' } | null;
  commentText: string;
  onCommentTextChange: (text: string) => void;
  onSubmitComment: () => void;
  onCancelComment: () => void;
  onDeleteComment: (id: string) => void;
}

const FileDiffSection = forwardRef<HTMLDivElement, FileDiffSectionProps>(
  function FileDiffSection(
    { file, isCollapsed, onToggle, onLineClick, comments, commentingOn, commentText, onCommentTextChange, onSubmitComment, onCancelComment, onDeleteComment },
    ref
  ) {
    const [copied, setCopied] = useState(false);
    const hunks = useMemo(() => parseUnifiedDiff(file.diff), [file.diff]);

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
      <div ref={ref} data-file-path={file.path} style={{ borderBottom: '1px solid var(--dp-border-subtle)' }}>
        {/* Sticky file header */}
        <div
          className="sticky top-0 z-10 flex items-center gap-1 px-2 cursor-pointer select-none"
          style={{
            backgroundColor: 'var(--dp-bg-secondary)',
            borderBottom: '1px solid var(--dp-border-subtle)',
            fontFamily: 'var(--dp-font-mono)',
            fontSize: 'var(--dp-font-sm)',
            lineHeight: 'var(--dp-lh-compact)',
          }}
          onClick={onToggle}
        >
          <span style={{ color: 'var(--dp-text-tertiary)', fontSize: '9px', width: '12px', textAlign: 'center' }}>
            {isCollapsed ? '\u25B8' : '\u25BE'}
          </span>

          <span className="truncate min-w-0 flex-1">
            {file.oldPath ? (
              <>
                <span style={{ color: 'var(--dp-accent-error)', textDecoration: 'line-through' }}>{file.oldPath}</span>
                <span style={{ color: 'var(--dp-text-tertiary)' }}> {'\u2192'} </span>
                <span style={{ color: 'var(--dp-text-primary)' }}>{file.path}</span>
              </>
            ) : (
              <span style={{ color: 'var(--dp-text-primary)' }}>{file.path}</span>
            )}
          </span>

          {file.isGenerated && (
            <span
              className="px-1 rounded shrink-0"
              style={{
                fontSize: '10px',
                backgroundColor: 'var(--dp-border-default)',
                color: 'var(--dp-text-tertiary)',
              }}
            >
              generated
            </span>
          )}

          <span className="shrink-0 flex items-center gap-1.5 ml-auto">
            <span style={{ color: 'var(--dp-accent-success)' }}>+{file.additions}</span>
            {file.deletions > 0 && <span style={{ color: 'var(--dp-accent-error)' }}>-{file.deletions}</span>}
            <span className="flex gap-px">
              {Array.from({ length: addBlocks }).map((_, i) => (
                <span key={`a${i}`} style={{ width: '5px', height: '8px', borderRadius: '1px', backgroundColor: 'var(--dp-accent-success)' }} />
              ))}
              {Array.from({ length: delBlocks }).map((_, i) => (
                <span key={`d${i}`} style={{ width: '5px', height: '8px', borderRadius: '1px', backgroundColor: 'var(--dp-accent-error)' }} />
              ))}
              {Array.from({ length: Math.max(0, 5 - addBlocks - delBlocks) }).map((_, i) => (
                <span key={`e${i}`} style={{ width: '5px', height: '8px', borderRadius: '1px', backgroundColor: 'var(--dp-border-default)' }} />
              ))}
            </span>
            <button
              onClick={copyPath}
              className="p-0.5 rounded hover:bg-[var(--dp-bg-hover)] transition-colors"
              title="Copy path"
            >
              <span style={{ color: copied ? 'var(--dp-accent-success)' : 'var(--dp-text-tertiary)', fontSize: '11px' }}>
                {copied ? '\u2713' : '\u2398'}
              </span>
            </button>
          </span>
        </div>

        {/* Diff content */}
        {!isCollapsed && (
          <div className="overflow-x-auto">
            {hunks.length === 0 ? (
              <div
                className="px-4 py-2 text-center"
                style={{
                  fontFamily: 'var(--dp-font-mono)',
                  fontSize: 'var(--dp-font-sm)',
                  color: 'var(--dp-text-tertiary)',
                }}
              >
                No diff content
              </div>
            ) : (
              <table
                className="w-full border-collapse"
                style={{
                  tableLayout: 'fixed',
                  fontFamily: 'var(--dp-font-mono)',
                  fontSize: 'var(--dp-font-sm)',
                  lineHeight: 'var(--dp-lh-code)',
                }}
              >
                <colgroup>
                  <col style={{ width: '50px' }} />
                  <col style={{ width: '50px' }} />
                  <col />
                </colgroup>
                <tbody>
                  {hunks.map((hunk, hi) => (
                    <HunkRows
                      key={hi}
                      hunk={hunk}
                      hunkIndex={hi}
                      onLineClick={onLineClick}
                      comments={comments}
                      commentingOn={commentingOn}
                      commentText={commentText}
                      onCommentTextChange={onCommentTextChange}
                      onSubmitComment={onSubmitComment}
                      onCancelComment={onCancelComment}
                      onDeleteComment={onDeleteComment}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    );
  }
);

// --- Hunk rows ---

interface HunkRowsProps {
  hunk: DiffHunk;
  hunkIndex: number;
  onLineClick: (lineNumber: number, lineType: 'old' | 'new') => void;
  comments: InlineComment[];
  commentingOn: { lineNumber: number; lineType: 'old' | 'new' } | null;
  commentText: string;
  onCommentTextChange: (text: string) => void;
  onSubmitComment: () => void;
  onCancelComment: () => void;
  onDeleteComment: (id: string) => void;
}

function HunkRows({
  hunk,
  hunkIndex,
  onLineClick,
  comments,
  commentingOn,
  commentText,
  onCommentTextChange,
  onSubmitComment,
  onCancelComment,
  onDeleteComment,
}: HunkRowsProps) {
  const rows: React.ReactNode[] = [];

  // Hunk header
  rows.push(
    <tr key={`hunk-${hunkIndex}`} style={{ backgroundColor: 'var(--dp-diff-hunk-bg)' }}>
      <td
        colSpan={3}
        className="px-2"
        style={{ color: 'var(--dp-diff-hunk-text)', lineHeight: 'var(--dp-lh-code)' }}
      >
        @@ -{hunk.oldStart},{hunk.oldCount} +{hunk.newStart},{hunk.newCount} @@
        {hunk.context && (
          <span className="ml-2 opacity-60">{hunk.context}</span>
        )}
      </td>
    </tr>
  );

  // Lines
  for (let li = 0; li < hunk.lines.length; li++) {
    const line = hunk.lines[li];
    if (line.type === 'header') continue;

    const lineKey = `${hunkIndex}-${li}`;
    const lineNumber = line.type === 'remove' ? line.oldNumber : line.newNumber;
    const lineType: 'old' | 'new' = line.type === 'remove' ? 'old' : 'new';

    const lineComments = comments.filter(
      (c) => c.lineNumber === lineNumber && c.lineType === lineType
    );
    const isCommenting =
      commentingOn?.lineNumber === lineNumber && commentingOn?.lineType === lineType;

    const bgColor =
      line.type === 'add'
        ? 'var(--dp-diff-add-bg)'
        : line.type === 'remove'
          ? 'var(--dp-diff-del-bg)'
          : 'transparent';

    const hoverBg =
      line.type === 'add'
        ? 'var(--dp-diff-add-bg-emphasis)'
        : line.type === 'remove'
          ? 'var(--dp-diff-del-bg-emphasis)'
          : 'var(--dp-bg-hover)';

    const gutterBg =
      line.type === 'add'
        ? 'var(--dp-diff-add-gutter)'
        : line.type === 'remove'
          ? 'var(--dp-diff-del-gutter)'
          : 'var(--dp-diff-gutter-bg)';

    rows.push(
      <tr
        key={lineKey}
        className="group/line"
        style={{ backgroundColor: bgColor }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = hoverBg; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = bgColor; }}
      >
        <td
          className="text-right pr-1 pl-0.5 select-none cursor-pointer align-top"
          style={{
            color: 'var(--dp-diff-gutter-text)',
            borderRight: '1px solid var(--dp-diff-gutter-border)',
            backgroundColor: gutterBg,
            width: '50px',
            minWidth: '50px',
          }}
          onClick={() => { if (line.oldNumber != null) onLineClick(line.oldNumber, 'old'); }}
        >
          {line.oldNumber ?? ''}
        </td>
        <td
          className="text-right pr-1 pl-0.5 select-none cursor-pointer align-top"
          style={{
            color: 'var(--dp-diff-gutter-text)',
            borderRight: '1px solid var(--dp-diff-gutter-border)',
            backgroundColor: gutterBg,
            width: '50px',
            minWidth: '50px',
          }}
          onClick={() => { if (line.newNumber != null) onLineClick(line.newNumber, 'new'); }}
        >
          {line.newNumber ?? ''}
        </td>
        <td className="pl-1.5 pr-3 whitespace-pre overflow-x-auto align-top">
          <span
            className="inline-block w-3 select-none text-center"
            style={{
              color:
                line.type === 'add'
                  ? 'var(--dp-accent-success)'
                  : line.type === 'remove'
                    ? 'var(--dp-accent-error)'
                    : 'transparent',
            }}
          >
            {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
          </span>
          <span
            style={{
              color: line.type === 'context' ? 'var(--dp-text-secondary)' : 'var(--dp-text-primary)',
            }}
          >
            {line.content}
          </span>
        </td>
      </tr>
    );

    // Inline comments
    for (const comment of lineComments) {
      rows.push(
        <tr key={`comment-${comment.id}`} style={{ backgroundColor: 'var(--dp-diff-hunk-bg)' }}>
          <td colSpan={2} style={{ borderRight: '1px solid var(--dp-diff-gutter-border)' }} />
          <td className="px-2 py-1">
            <div className="flex items-start gap-1.5">
              <div
                className="rounded px-2 py-1 flex-1"
                style={{
                  backgroundColor: 'var(--dp-bg-primary)',
                  border: '1px solid var(--dp-border-subtle)',
                  color: 'var(--dp-text-primary)',
                  fontFamily: 'var(--dp-font-sans)',
                  fontSize: 'var(--dp-font-sm)',
                }}
              >
                <p className="whitespace-pre-wrap">{comment.text}</p>
                <p style={{ fontSize: '10px', color: 'var(--dp-text-tertiary)', marginTop: '2px' }}>
                  {new Date(comment.timestamp).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => onDeleteComment(comment.id)}
                className="p-0.5 rounded hover:bg-[var(--dp-bg-hover)]"
                style={{ color: 'var(--dp-text-tertiary)', fontSize: '11px' }}
              >
                {'\u2715'}
              </button>
            </div>
          </td>
        </tr>
      );
    }

    // Comment input
    if (isCommenting) {
      rows.push(
        <tr key={`commenting-${lineKey}`} style={{ backgroundColor: 'var(--dp-diff-hunk-bg)' }}>
          <td colSpan={2} style={{ borderRight: '1px solid var(--dp-diff-gutter-border)' }} />
          <td className="px-2 py-1">
            <textarea
              autoFocus
              className="w-full rounded px-2 py-1 resize-none outline-none"
              style={{
                backgroundColor: 'var(--dp-bg-primary)',
                border: '1px solid var(--dp-border-default)',
                color: 'var(--dp-text-primary)',
                fontFamily: 'var(--dp-font-sans)',
                fontSize: 'var(--dp-font-sm)',
              }}
              rows={2}
              placeholder="Add a comment..."
              value={commentText}
              onChange={(e) => onCommentTextChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.metaKey) onSubmitComment();
                if (e.key === 'Escape') onCancelComment();
              }}
            />
            <div className="flex items-center gap-1.5 mt-1">
              <button
                onClick={onSubmitComment}
                disabled={!commentText.trim()}
                className="px-1.5 py-px rounded disabled:opacity-40"
                style={{
                  fontFamily: 'var(--dp-font-sans)',
                  fontSize: 'var(--dp-font-xs)',
                  backgroundColor: 'var(--dp-accent-primary)',
                  color: '#fff',
                  border: 'none',
                }}
              >
                Comment
              </button>
              <button
                onClick={onCancelComment}
                className="px-1.5 py-px rounded"
                style={{
                  fontFamily: 'var(--dp-font-sans)',
                  fontSize: 'var(--dp-font-xs)',
                  color: 'var(--dp-text-tertiary)',
                }}
              >
                Cancel
              </button>
              <span className="ml-auto" style={{ fontFamily: 'var(--dp-font-sans)', fontSize: '10px', color: 'var(--dp-text-tertiary)' }}>
                {'\u2318'}+Enter
              </span>
            </div>
          </td>
        </tr>
      );
    }
  }

  return <>{rows}</>;
}
