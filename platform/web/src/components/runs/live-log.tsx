"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";

const RUNNER_URL =
  process.env.NEXT_PUBLIC_RUNNER_URL || "http://localhost:4800";

interface LiveLogProps {
  runId: string;
  jobId: string;
  stepIndex: number;
  initialLog?: string;
}

export function LiveLog({ runId, jobId, stepIndex, initialLog }: LiveLogProps) {
  const [lines, setLines] = useState<string[]>(
    initialLog ? initialLog.split("\n") : []
  );
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource(
        `${RUNNER_URL}/api/runs/${runId}/logs?job=${jobId}&step=${stepIndex}`
      );

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.line) {
            setLines((prev) => [...prev, data.line]);
          }
        } catch {
          // ignore
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
      };
    } catch {
      // SSE not available, use initial log
    }

    return () => {
      eventSource?.close();
    };
  }, [runId, jobId, stepIndex]);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [lines, autoScroll]);

  return (
    <div className="relative rounded-md bg-zinc-950 overflow-hidden">
      <ScrollArea className="h-[400px]">
        <div className="p-3 font-mono text-xs leading-5">
          {lines.map((line, i) => (
            <div key={i} className="flex">
              <span className="w-10 text-right pr-3 text-zinc-600 select-none shrink-0">
                {i + 1}
              </span>
              <span
                className={
                  line.includes("error") || line.includes("FAIL")
                    ? "text-red-400"
                    : line.includes("success") || line.startsWith("✓")
                      ? "text-emerald-400"
                      : "text-zinc-300"
                }
              >
                {line}
              </span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {!autoScroll && (
        <Button
          variant="secondary"
          size="sm"
          className="absolute bottom-4 right-4"
          onClick={() => setAutoScroll(true)}
        >
          <ArrowDown className="h-3 w-3 mr-1" />
          Follow
        </Button>
      )}
    </div>
  );
}
