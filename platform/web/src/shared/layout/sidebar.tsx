"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Dashboard', key: 'D' },
  { href: '/diffs', label: 'Diffs', key: 'S' },
  { href: '/features', label: 'Features', key: 'F' },
  { href: '/prs', label: 'Commits', key: 'C' },
  { href: '/runs', label: 'Runs', key: 'R' },
];

/** Pattern: /diffs/<slug>/<position-number> --- full-viewport review mode */
const DIFF_REVIEW_RE = /^\/diffs\/[^/]+\/\d+/;

export function Sidebar() {
  const pathname = usePathname();

  // Hide sidebar completely on diff review pages
  if (DIFF_REVIEW_RE.test(pathname)) return null;

  return (
    <aside
      className="flex flex-col shrink-0"
      style={{
        width: '180px',
        backgroundColor: 'var(--dp-diff-gutter-bg)',
        borderRight: '1px solid var(--dp-border-subtle)',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center px-3"
        style={{
          height: '36px',
          borderBottom: '1px solid var(--dp-border-subtle)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--dp-font-lg)',
            fontWeight: 700,
            color: 'var(--dp-text-primary)',
            letterSpacing: '-0.02em',
          }}
        >
          DevPod
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-1 px-1">
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 px-2 rounded transition-colors"
              style={{
                lineHeight: 'var(--dp-lh-ui)',
                fontSize: 'var(--dp-font-base)',
                fontWeight: isActive ? 500 : 400,
                backgroundColor: isActive ? 'var(--dp-bg-active)' : 'transparent',
                color: isActive ? 'var(--dp-text-primary)' : 'var(--dp-text-secondary)',
                borderRadius: 'var(--dp-radius-sm)',
              }}
              prefetch={true}
            >
              <span style={{ fontFamily: 'var(--dp-font-mono)', fontSize: 'var(--dp-font-xs)', color: 'var(--dp-text-tertiary)', width: '14px', textAlign: 'center' }}>
                {item.key}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-2" style={{ borderTop: '1px solid var(--dp-border-subtle)' }}>
        <span style={{ fontSize: '10px', fontFamily: 'var(--dp-font-mono)', color: 'var(--dp-text-tertiary)' }}>
          v0.1.0
        </span>
      </div>
    </aside>
  );
}
