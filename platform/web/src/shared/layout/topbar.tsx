"use client";

import { usePathname } from 'next/navigation';

/** Pattern: /diffs/<slug>/<position-number> --- full-viewport review mode */
const DIFF_REVIEW_RE = /^\/diffs\/[^/]+\/\d+/;

export function Topbar() {
  const pathname = usePathname();

  // Hide topbar on diff review pages
  if (DIFF_REVIEW_RE.test(pathname)) return null;

  return (
    <header
      className="flex items-center justify-between px-3 shrink-0"
      style={{
        height: '36px',
        borderBottom: '1px solid var(--dp-border-subtle)',
        backgroundColor: 'var(--dp-bg-secondary)',
      }}
    >
      <span
        style={{
          fontSize: 'var(--dp-font-sm)',
          fontFamily: 'var(--dp-font-mono)',
          color: 'var(--dp-text-tertiary)',
        }}
      >
        devpod/platform
      </span>

      <span
        style={{
          fontSize: 'var(--dp-font-xs)',
          fontFamily: 'var(--dp-font-mono)',
          color: 'var(--dp-text-tertiary)',
          opacity: 0.5,
        }}
      >
        {'\u2318'}K to search
      </span>
    </header>
  );
}
