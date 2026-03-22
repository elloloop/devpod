"use client";

import { Film } from "lucide-react";

interface VideoPlayerProps {
  src?: string;
  title: string;
}

export function VideoPlayer({ src, title }: VideoPlayerProps) {
  if (!src) {
    return (
      <div className="rounded-lg bg-muted flex items-center justify-center h-64">
        <div className="text-center text-muted-foreground">
          <Film className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No demo video available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden bg-black">
      <video
        controls
        className="w-full"
        preload="metadata"
        title={title}
      >
        <source src={src} type="video/mp4" />
        <p>Your browser does not support the video element.</p>
      </video>
    </div>
  );
}
