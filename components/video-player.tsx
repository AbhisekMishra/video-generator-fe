"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Sparkles } from "lucide-react";
import { RenderedVideo } from "@/lib/types";

interface VideoPlayerProps {
  videos: RenderedVideo[];
}

export function VideoPlayer({ videos }: VideoPlayerProps) {
  if (videos.length === 0) {
    return null;
  }

  const handleDownload = (videoUrl: string, clipIndex: number) => {
    const link = document.createElement("a");
    link.href = videoUrl;
    link.download = `clip-${clipIndex + 1}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Generated Clips
          </CardTitle>
          <span className="text-sm text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full font-medium">
            {videos.length} clip{videos.length !== 1 ? "s" : ""}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {videos.map((video, index) => (
            <div
              key={index}
              className="group rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="aspect-[9/16] bg-black relative">
                <video
                  src={video.url}
                  controls
                  className="w-full h-full object-contain"
                  preload="metadata"
                >
                  Your browser does not support the video tag.
                </video>
              </div>

              <div className="p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      Clip {index + 1}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {video.duration.toFixed(1)}s
                  </span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs"
                  onClick={() => handleDownload(video.url, index)}
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Download MP4
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
