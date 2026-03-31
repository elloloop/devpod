"use client";

import { useEffect, useState } from "react";

interface HealthData {
  status: string;
  service: string;
  version: string;
  timestamp: string;
}

export function VersionInfo() {
  const [health, setHealth] = useState<HealthData | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => setHealth(data))
      .catch(() => {});
  }, []);

  if (!health) return null;

  return (
    <div className="text-[10px] text-muted-foreground/50 font-mono">
      {health.service} v{health.version}
    </div>
  );
}
