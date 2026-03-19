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
    <div className="group flex flex-col rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow h-full">
      {/* Video thumbnail */}
      <div className="aspect-[9/16] bg-black flex-shrink-0">
        <video
          src={clipUrl}
          controls
          className="w-full h-full object-contain"
          preload="metadata"
        >
          Your browser does not support the video tag.
        </video>
      </div>

      {/* Label + download — flex-col so button always sticks to bottom */}
      <div className="flex flex-col flex-1 p-3 gap-2">
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
          className="w-full h-8 text-xs mt-auto"
          onClick={handleDownload}
        >
          <Download className="w-3.5 h-3.5 mr-1.5" />
          Download MP4
        </Button>
      </div>
    </div>
  );
}
