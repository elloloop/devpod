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
            <TableHead className="w-24">SHA</TableHead>
            <TableHead>Message</TableHead>
            <TableHead className="w-28">Author</TableHead>
            <TableHead className="w-20 text-center">Files</TableHead>
            <TableHead className="w-24 text-right">Changes</TableHead>
            <TableHead className="w-36">Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {prs.map((pr) => (
            <TableRow
              key={pr.sha}
              className="cursor-pointer hover:bg-accent/50"
            >
              <TableCell>
                <Link
                  href={`/prs/${pr.shortSha}`}
                  className="font-mono text-xs text-blue-400 hover:underline"
                >
                  {pr.shortSha}
                </Link>
              </TableCell>
              <TableCell>
                <Link
                  href={`/prs/${pr.shortSha}`}
                  className="font-medium hover:underline truncate block max-w-md"
                >
                  {pr.title}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {pr.author}
              </TableCell>
              <TableCell className="text-center text-sm text-muted-foreground">
                {pr.files.length}
              </TableCell>
              <TableCell className="text-right">
                <span className="text-emerald-400 text-xs font-mono">
                  +{pr.totalAdditions}
                </span>
                {pr.totalDeletions > 0 && (
                  <span className="text-red-400 text-xs font-mono ml-1.5">
                    -{pr.totalDeletions}
                  </span>
                )}
              </TableCell>
              <TableCell>
                <DateDisplay
                  date={pr.date}
                  className="text-sm text-muted-foreground"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
