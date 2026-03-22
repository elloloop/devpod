"use client";

import { ScrollArea } from "@/components/ui/scroll-area";

interface StepLogProps {
  log: string;
}

export function StepLog({ log }: StepLogProps) {
  if (!log) {
    return (
      <div className="rounded-md bg-zinc-950 p-3 text-xs text-zinc-500 font-mono">
        Waiting for output...
      </div>
    );
  }

  const lines = log.split("\n");

  return (
    <ScrollArea className="max-h-[400px]">
      <div className="rounded-md bg-zinc-950 p-3 font-mono text-xs leading-5">
        {lines.map((line, i) => (
          <div key={i} className="flex">
            <span className="w-8 text-right pr-3 text-zinc-600 select-none shrink-0">
              {i + 1}
            </span>
            <span
              className={
                line.startsWith("✓") || line.includes("success") || line.includes("passed")
                  ? "text-emerald-400"
                  : line.startsWith("✗") || line.includes("FAIL") || line.includes("Error") || line.includes("failed")
                    ? "text-red-400"
                    : line.startsWith("warning") || line.includes("warn")
                      ? "text-yellow-400"
                      : "text-zinc-300"
              }
            >
              {line}
            </span>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
