"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileVideo, CheckCircle2, Film } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoUploadDropzoneProps {
  onVideoSelect: (file: File) => void;
  disabled?: boolean;
  uploadProgress?: number;
  uploadStatus?: "idle" | "uploading" | "success" | "error";
}

export function VideoUploadDropzone({
  onVideoSelect,
  disabled = false,
  uploadProgress = 0,
  uploadStatus = "idle",
}: VideoUploadDropzoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onVideoSelect(acceptedFiles[0]);
      }
    },
    [onVideoSelect]
  );

  const { getRootProps, getInputProps, isDragActive, acceptedFiles } =
    useDropzone({
      onDrop,
      accept: {
        "video/*": [".mp4", ".mov", ".avi", ".mkv"],
      },
      maxFiles: 1,
      disabled,
    });

  const hasFile = acceptedFiles.length > 0;

  return (
    <div
      {...getRootProps()}
      className={cn(
        "relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200",
        isDragActive
          ? "border-primary bg-primary/5 scale-[1.01]"
          : "border-border hover:border-primary/50 hover:bg-muted/30",
        hasFile && uploadStatus !== "idle" && "border-solid",
        uploadStatus === "success" && "border-green-400/60 bg-green-50/50",
        disabled && "opacity-50 cursor-not-allowed pointer-events-none"
      )}
    >
      <input {...getInputProps()} />

      <div className="flex flex-col items-center gap-3">
        {hasFile ? (
          <>
            <div className={cn(
              "w-14 h-14 rounded-xl flex items-center justify-center",
              uploadStatus === "success" ? "bg-green-100" : "bg-primary/10"
            )}>
              {uploadStatus === "success" ? (
                <CheckCircle2 className="w-7 h-7 text-green-600" />
              ) : (
                <Film className="w-7 h-7 text-primary" />
              )}
            </div>

            <div className="w-full">
              <p className="font-semibold text-base truncate px-4">
                {acceptedFiles[0].name}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {(acceptedFiles[0].size / 1024 / 1024).toFixed(2)} MB
              </p>

              {uploadStatus === "uploading" && (
                <div className="mt-4 w-full">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs text-muted-foreground">Uploading...</span>
                    <span className="text-xs font-semibold text-primary">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {uploadStatus === "success" && (
                <p className="text-sm text-green-600 font-medium mt-2">
                  ✓ Upload complete
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className={cn(
              "w-14 h-14 rounded-xl flex items-center justify-center transition-colors",
              isDragActive ? "bg-primary/15" : "bg-muted"
            )}>
              <Upload className={cn(
                "w-6 h-6 transition-colors",
                isDragActive ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
            <div>
              <p className="font-semibold text-base">
                {isDragActive ? "Drop your video here" : "Drag & drop a video file"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                or click to browse &mdash; MP4, MOV, AVI, MKV
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
