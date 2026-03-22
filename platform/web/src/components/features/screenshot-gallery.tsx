"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImageIcon } from "lucide-react";

interface ScreenshotGalleryProps {
  screenshots: string[];
  title: string;
}

export function ScreenshotGallery({
  screenshots,
  title,
}: ScreenshotGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (screenshots.length === 0) {
    return (
      <div className="rounded-lg bg-muted flex items-center justify-center h-32">
        <div className="text-center text-muted-foreground">
          <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No screenshots available</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {screenshots.map((src, i) => (
          <button
            key={src}
            onClick={() => setSelectedIndex(i)}
            className="group relative aspect-video rounded-lg bg-muted overflow-hidden border hover:border-primary/50 transition-colors"
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <ImageIcon className="h-8 w-8 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/80 to-transparent p-2">
              <p className="text-xs text-muted-foreground truncate">
                {src.split("/").pop()}
              </p>
            </div>
          </button>
        ))}
      </div>

      <Dialog
        open={selectedIndex !== null}
        onOpenChange={() => setSelectedIndex(null)}
      >
        <DialogContent className="max-w-4xl">
          <DialogTitle>
            {title} - Screenshot {selectedIndex !== null ? selectedIndex + 1 : ""}
          </DialogTitle>
          {selectedIndex !== null && (
            <div className="flex items-center justify-center min-h-[300px] bg-muted rounded-lg">
              <div className="text-center text-muted-foreground">
                <ImageIcon className="h-16 w-16 mx-auto mb-3 opacity-50" />
                <p className="text-sm">{screenshots[selectedIndex]}</p>
                <p className="text-xs mt-1 opacity-60">
                  Screenshot preview (image file not found on disk)
                </p>
              </div>
            </div>
          )}
          <div className="flex gap-2 justify-center mt-2">
            {screenshots.map((_, i) => (
              <button
                key={i}
                onClick={() => setSelectedIndex(i)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === selectedIndex ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
