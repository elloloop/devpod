"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

const shortcuts = [
  { key: "j", description: "Next file" },
  { key: "k", description: "Previous file" },
  { key: "n", description: "Next diff" },
  { key: "p", description: "Previous diff" },
  { key: "/", description: "Search" },
  { key: "?", description: "Show shortcuts" },
];

export function KeyboardShortcuts() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setVisible((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setVisible(false)}>
      <div className="bg-card border rounded-lg p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Keyboard Shortcuts</h2>
        <div className="space-y-2">
          {shortcuts.map((s) => (
            <div key={s.key} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{s.description}</span>
              <Badge variant="outline" className="font-mono text-xs">{s.key}</Badge>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4">Press ? to toggle</p>
      </div>
    </div>
  );
}
