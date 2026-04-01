"use client";

import { usePathname } from "next/navigation";
import { Sun, Moon, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/providers/theme-provider";

/** Pattern: /diffs/<slug>/<position-number> — full-viewport review mode */
const DIFF_REVIEW_RE = /^\/diffs\/[^/]+\/\d+/;

export function Topbar() {
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();

  // Hide topbar on diff review pages (they have their own header)
  if (DIFF_REVIEW_RE.test(pathname)) return null;

  return (
    <header className="flex items-center justify-between border-b bg-card px-6 py-3">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          devpod/platform
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="w-64 pl-9 h-9 bg-background"
          />
        </div>

        <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9">
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>
      </div>
    </header>
  );
}
