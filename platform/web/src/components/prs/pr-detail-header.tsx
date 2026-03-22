"use client";

import { useState } from "react";
import Link from "next/link";
import { DateDisplay } from "@/components/shared/date-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitCommit, Copy, Check, FileCode, Plus, Minus, User } from "lucide-react";
import type { PullRequest } from "@/lib/types";

interface PRDetailHeaderProps {
  pr: PullRequest;
}

export function PRDetailHeader({ pr }: PRDetailHeaderProps) {
  const [copied, setCopied] = useState(false);

  const copySha = () => {
    navigator.clipboard.writeText(pr.sha);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-tight">{pr.title}</h1>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <GitCommit className="h-4 w-4 text-muted-foreground" />
              <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                {pr.shortSha}
              </code>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={copySha}
                title="Copy full SHA"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>

            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              <span>{pr.author}</span>
            </div>

            <DateDisplay
              date={pr.date}
              className="text-sm text-muted-foreground"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="secondary" className="gap-1 font-mono text-xs">
              <FileCode className="h-3 w-3" />
              {pr.files.length} files
            </Badge>
            <Badge
              variant="outline"
              className="gap-1 font-mono text-xs text-emerald-400 border-emerald-500/30"
            >
              <Plus className="h-3 w-3" />
              {pr.totalAdditions}
            </Badge>
            <Badge
              variant="outline"
              className="gap-1 font-mono text-xs text-red-400 border-red-500/30"
            >
              <Minus className="h-3 w-3" />
              {pr.totalDeletions}
            </Badge>
          </div>
        </div>
      </div>

      {pr.parentSha && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Parent:</span>
          <Link href={`/prs/${pr.parentSha.substring(0, 7)}`}>
            <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono text-blue-400 hover:underline cursor-pointer">
              {pr.parentSha.substring(0, 7)}
            </code>
          </Link>
        </div>
      )}

      {pr.body && (
        <div className="rounded-lg border bg-muted/30 p-4">
          <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans">
            {pr.body}
          </pre>
        </div>
      )}
    </div>
  );
}
