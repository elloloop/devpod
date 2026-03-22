"use client";

import { formatDistanceToNow, format } from "date-fns";

interface DateDisplayProps {
  date: string;
  relative?: boolean;
  className?: string;
}

export function DateDisplay({
  date,
  relative = true,
  className,
}: DateDisplayProps) {
  const d = new Date(date);
  const formatted = format(d, "MMM d, yyyy 'at' h:mm a");
  const relativeStr = formatDistanceToNow(d, { addSuffix: true });

  return (
    <time dateTime={date} title={formatted} className={className}>
      {relative ? relativeStr : formatted}
    </time>
  );
}
