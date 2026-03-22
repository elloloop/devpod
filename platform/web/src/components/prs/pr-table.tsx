"use client";

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { DateDisplay } from "@/components/shared/date-display";
import type { PullRequest } from "@/lib/types";

interface PRTableProps {
  prs: PullRequest[];
}

export function PRTable({ prs }: PRTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">#</TableHead>
            <TableHead>Title</TableHead>
            <TableHead className="w-24">Author</TableHead>
            <TableHead className="w-28">Status</TableHead>
            <TableHead className="w-28">Checks</TableHead>
            <TableHead className="w-36">Feature</TableHead>
            <TableHead className="w-36">Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {prs.map((pr) => {
            const checksConclusion = pr.checks.length > 0
              ? pr.checks.some((c) => c.conclusion === "failure")
                ? "failure"
                : pr.checks.every((c) => c.conclusion === "success")
                  ? "success"
                  : pr.checks.some((c) => c.status === "in_progress")
                    ? "in_progress"
                    : "queued"
              : null;

            return (
              <TableRow key={pr.number} className="cursor-pointer hover:bg-accent/50">
                <TableCell>
                  <Link
                    href={`/prs/${pr.number}`}
                    className="text-muted-foreground font-mono"
                  >
                    {pr.number}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/prs/${pr.number}`} className="font-medium hover:underline">
                    {pr.title}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {pr.author}
                </TableCell>
                <TableCell>
                  <StatusBadge status={pr.status} />
                </TableCell>
                <TableCell>
                  {checksConclusion && (
                    <StatusBadge status={checksConclusion} />
                  )}
                </TableCell>
                <TableCell>
                  {pr.feature && (
                    <Link
                      href={`/features/${pr.feature}`}
                      className="text-sm text-blue-400 hover:underline"
                    >
                      {pr.feature}
                    </Link>
                  )}
                </TableCell>
                <TableCell>
                  <DateDisplay
                    date={pr.createdAt}
                    className="text-sm text-muted-foreground"
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
