"use client";

import { useState } from 'react';
import type { DiffFile } from '@/packages/diff-engine';

interface FileTreeProps {
  files: DiffFile[];
  onFileClick: (path: string) => void;
}

export function FileTree({ files, onFileClick }: FileTreeProps) {
  const [expanded, setExpanded] = useState(files.length <= 8);

  return (
    <div
      style={{
        borderBottom: '1px solid var(--dp-border-subtle)',
        fontFamily: 'var(--dp-font-mono)',
        fontSize: 'var(--dp-font-xs)',
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 w-full px-2 hover:bg-[var(--dp-bg-hover)] transition-colors"
        style={{ color: 'var(--dp-text-tertiary)', lineHeight: 'var(--dp-lh-compact)' }}
      >
        <span style={{ fontSize: '9px' }}>{expanded ? '\u25BE' : '\u25B8'}</span>
        <span>{files.length} {files.length === 1 ? 'file' : 'files'} changed</span>
      </button>

      {expanded && (
        <div className="pb-0.5">
          {files.map((file) => {
            const totalChanges = file.additions + file.deletions;
            const maxBlocks = 10;
            const addBlocks = totalChanges > 0 ? Math.round((file.additions / totalChanges) * maxBlocks) : 0;
            const delBlocks = totalChanges > 0 ? Math.round((file.deletions / totalChanges) * maxBlocks) : 0;
            const emptyBlocks = Math.max(0, maxBlocks - addBlocks - delBlocks);

            const lastSlash = file.path.lastIndexOf('/');
            const dir = lastSlash >= 0 ? file.path.substring(0, lastSlash + 1) : '';
            const name = lastSlash >= 0 ? file.path.substring(lastSlash + 1) : file.path;

            return (
              <button
                key={file.path}
                onClick={() => onFileClick(file.path)}
                className="flex items-center gap-1.5 w-full px-2.5 hover:bg-[var(--dp-bg-hover)] transition-colors text-left"
                style={{ lineHeight: 'var(--dp-lh-code)' }}
              >
                <span className="truncate flex-1 min-w-0">
                  <span style={{ color: 'var(--dp-text-tertiary)' }}>{dir}</span>
                  <span style={{ color: 'var(--dp-text-primary)' }}>{name}</span>
                </span>
                <span className="shrink-0 flex items-center gap-1">
                  <span style={{ color: 'var(--dp-accent-success)' }}>+{file.additions}</span>
                  {file.deletions > 0 && (
                    <span style={{ color: 'var(--dp-accent-error)' }}>-{file.deletions}</span>
                  )}
                  <span className="flex gap-px ml-0.5">
                    {Array.from({ length: addBlocks }).map((_, i) => (
                      <span
                        key={`a${i}`}
                        style={{ width: '3px', height: '8px', borderRadius: '1px', backgroundColor: 'var(--dp-accent-success)' }}
                      />
                    ))}
                    {Array.from({ length: delBlocks }).map((_, i) => (
                      <span
                        key={`d${i}`}
                        style={{ width: '3px', height: '8px', borderRadius: '1px', backgroundColor: 'var(--dp-accent-error)' }}
                      />
                    ))}
                    {Array.from({ length: emptyBlocks }).map((_, i) => (
                      <span
                        key={`e${i}`}
                        style={{ width: '3px', height: '8px', borderRadius: '1px', backgroundColor: 'var(--dp-border-default)' }}
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
