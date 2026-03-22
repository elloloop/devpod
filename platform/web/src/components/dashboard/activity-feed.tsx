"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge } from "@/components/shared/status-badge";
import { DateDisplay } from "@/components/shared/date-display";
import { Film, GitPullRequest, Play } from "lucide-react";
import type { ActivityItem } from "@/lib/types";

const typeIcons: Record<string, React.ElementType> = {
  pr: GitPullRequest,
  feature: Film,
  run: Play,
};

interface ActivityFeedProps {
  activity: ActivityItem[];
}

export function ActivityFeed({ activity }: ActivityFeedProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="divide-y">
            {activity.map((item) => {
              const Icon = typeIcons[item.type] || Play;
              return (
                <Link
                  key={item.id}
                  href={item.link}
                  className="flex items-start gap-4 px-6 py-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="mt-0.5 rounded-md bg-muted p-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">
                        {item.title}
                      </p>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {item.description}
                    </p>
                  </div>
                  <DateDisplay
                    date={item.date}
                    className="text-xs text-muted-foreground whitespace-nowrap"
                  />
                </Link>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
