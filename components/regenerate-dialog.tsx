"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface RegenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingClipCount: number;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function RegenerateDialog({
  open,
  onOpenChange,
  existingClipCount,
  onConfirm,
  isLoading,
}: RegenerateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate More Clips</DialogTitle>
          <DialogDescription>
            This will create up to 3 new clips from the same original video,
            avoiding the {existingClipCount} clip{existingClipCount !== 1 ? "s" : ""} already
            generated.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 text-sm text-muted-foreground">
          The AI will analyze the video and find different moments it hasn&apos;t
          clipped yet. Results may vary depending on remaining content.
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            {isLoading ? "Starting..." : "Generate Clips"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
