"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ClipCardProps {
  clipUrl: string;
  index: number;
  duration?: number;
  globalIndex?: number; // index across all sessions for display label
}

export function ClipCard({ clipUrl, index, duration, globalIndex }: ClipCardProps) {
  const label = globalIndex !== undefined ? globalIndex + 1 : index + 1;

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = clipUrl;
    link.download = `clip-${label}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="group rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow">
      <div className="aspect-[9/16] bg-black relative">
        <video
          src={clipUrl}
          controls
          className="w-full h-full object-contain"
          preload="metadata"
        >
          Your browser does not support the video tag.
        </video>
      </div>

      <div className="p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            Clip {label}
          </span>
          {duration !== undefined && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {duration.toFixed(1)}s
            </span>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs"
          onClick={handleDownload}
        >
          <Download className="w-3.5 h-3.5 mr-1.5" />
          Download MP4
        </Button>
      </div>
    </div>
  );
}
