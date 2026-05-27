"use client";

import { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipCard, ClipCardSkeleton } from "@/components/clip-card";
import { StatusBadge } from "@/components/status-badge";
import { RegenerateDialog } from "@/components/regenerate-dialog";
import { WorkflowProgress } from "@/components/workflow-progress";
import Link from "next/link";
import { Trash2, RefreshCw, Video, Sparkles, AlertCircle } from "lucide-react";
import type { Session, ClipMetadata } from "@/lib/session";

const MAX_RETRIES = 3;

const YOUTUBE_PATTERN =
  /(?:youtube\.com\/(?:watch\?.*v=|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

function extractYoutubeId(url: string): string | null {
  const match = url.match(YOUTUBE_PATTERN);
  return match ? match[1] : null;
}

interface SessionGroupCardProps {
  /** All sessions for this video (same original_video_path), sorted by created_at ascending */
  sessions: Session[];
  onDelete: (sessionId: string) => void;
  onRegenerateComplete: (newSession: Session) => void;
  onRetry?: (sessionId: string) => void;
  /** Queue position for any queued session in this group (1-indexed) */
  queuePosition?: number;
  estimatedWaitSeconds?: number;
}

type WorkflowStage = "transcribe" | "identifyClips" | "detectFocus" | "render" | "completed";

function getTranscriptionErrorMessage(errorMessage: string | null): string {
  if (!errorMessage) return "Processing failed. Try a different video or check that it contains clear speech.";
  if (errorMessage.startsWith("video_too_short:")) {
    const secs = parseFloat(errorMessage.split(":")[1]);
    return `Your video is only ${secs.toFixed(0)}s long — we need at least 20 seconds of spoken content to find clips.`;
  }
  if (errorMessage === "no_audio_track") return "This video has no audio track. Please upload a video with speech.";
  if (errorMessage === "no_speech_detected") return "We couldn't detect any speech in your video. Make sure it contains clear, audible dialogue.";
  return "Processing failed. Try a different video or check that it contains clear speech.";
}

const stageNodeMap: Record<string, WorkflowStage> = {
  transcribe: "transcribe",
  identifyClips: "identifyClips",
  detectFocus: "detectFocus",
  render: "render",
  completed: "completed",
};

export function SessionGroupCard({
  sessions,
  onDelete,
  onRegenerateComplete,
  onRetry,
  queuePosition,
  estimatedWaitSeconds,
}: SessionGroupCardProps) {
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [liveSession, setLiveSession] = useState<Session | null>(null);
  const [liveStage, setLiveStage] = useState<WorkflowStage | undefined>();
  const [regenError, setRegenError] = useState<string | null>(null);

  // The first session is the "root" (original upload)
  const rootSession = sessions[0];

  // Collect all completed clip URLs across all sessions
  const allClipUrls = sessions.flatMap((s) =>
    s.status === "completed" ? s.clip_paths ?? [] : []
  );

  // Collect all clips_metadata to count for the dialog
  const allExistingClips: ClipMetadata[] = sessions.flatMap(
    (s) => s.clips_metadata ?? []
  );

  // Determine if any session is currently queued or processing
  const activeSession =
    liveSession ??
    sessions.find(
      (s) => s.status === "queued" || s.status === "processing" || s.status === "pending"
    ) ??
    null;

  const latestCompletedSession = [...sessions]
    .reverse()
    .find((s) => s.status === "completed");

  const latestSession = sessions[sessions.length - 1];
  const latestFailedSession =
    latestSession?.status === "failed" ? latestSession : null;

  const processingSession = liveSession ?? activeSession;
  const skeletonCount =
    processingSession?.clips_metadata?.length ||
    processingSession?.total_clips ||
    3;

  const canRegenerate =
    !isRegenerating &&
    !activeSession &&
    (latestCompletedSession || sessions.some((s) => s.status === "completed"));

  const handleRegenerateConfirm = useCallback(async () => {
    setIsRegenerating(true);
    setRegenError(null);

    try {
      // Step 1: Create a new session reusing the same video
      const regenRes = await fetch(`/api/sessions/${rootSession.id}/regenerate`, {
        method: "POST",
      });
      if (!regenRes.ok) {
        const err = await regenRes.json();
        throw new Error(err.error ?? "Failed to start regeneration");
      }
      const { sessionId, threadId, videoUrl, filePath, existingClips } =
        await regenRes.json();

      setShowRegenerateDialog(false);

      // Create an optimistic "processing" session object to show progress inline
      const optimisticSession: Session = {
        ...rootSession,
        id: sessionId,
        thread_id: threadId,
        status: "processing",
        current_stage: "transcribe",
        progress: 10,
        clip_paths: [],
        caption_paths: [],
        clips_metadata: [],
        total_clips: 0,
        completed_clips: 0,
        error_message: null,
        error_stage: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: null,
      };
      setLiveSession(optimisticSession);
      setLiveStage("transcribe");

      // Step 2: Start processing stream
      const streamRes = await fetch("/api/process-video/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, threadId, videoUrl, filePath, existingClips }),
      });

      if (!streamRes.ok) throw new Error("Processing stream failed to start");

      const reader = streamRes.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response stream");

      // Step 3: Read SSE events
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));

          if (data.status === "completed") {
            const completedSession: Session = {
              ...optimisticSession,
              status: "completed",
              current_stage: "completed",
              progress: 100,
              clip_paths: (data.state?.renderedVideos ?? []).map((v: any) => v.url),
              clips_metadata: (data.state?.renderedVideos ?? [])
                .filter((v: any) => v.clip)
                .map((v: any) => ({
                  start: v.clip.start,
                  end: v.clip.end,
                  title: v.clip.title ?? null,
                  score: v.clip.score ?? 0,
                })),
              completed_at: new Date().toISOString(),
            };
            setLiveSession(null);
            setLiveStage(undefined);
            onRegenerateComplete(completedSession);
            setIsRegenerating(false);
            return;
          }

          if (data.node) {
            const stage = stageNodeMap[data.node];
            if (stage) setLiveStage(stage);
          }

          if (data.error) throw new Error(data.error);
        }
      }
    } catch (err) {
      setRegenError(err instanceof Error ? err.message : "Regeneration failed");
      setLiveSession(null);
      setLiveStage(undefined);
      setIsRegenerating(false);
    }
  }, [rootSession, onRegenerateComplete]);

  const handleRetry = useCallback(async () => {
    if (!latestFailedSession) return;
    setIsRetrying(true);
    setRetryError(null);
    try {
      const res = await fetch(`/api/sessions/${latestFailedSession.id}/retry`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Retry failed");
      }
      onRetry?.(latestFailedSession.id);
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setIsRetrying(false);
    }
  }, [latestFailedSession, onRetry]);

  const handleDelete = async () => {
    // Delete all sessions for this video group (root is sufficient since we group by video path)
    onDelete(rootSession.id);
  };

  const uploadedAt = new Date(rootSession.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <>
      <Card className="shadow-sm border overflow-hidden">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Video className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate leading-tight">
                {rootSession.original_filename ?? "Untitled video"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Uploaded {uploadedAt}
                {allClipUrls.length > 0 && ` · ${allClipUrls.length} clip${allClipUrls.length !== 1 ? "s" : ""} generated`}
                {sessions.length > 1 && ` · ${sessions.length} runs`}
              </p>
            </div>
          </div>
          <StatusBadge
            status={activeSession ? activeSession.status : (latestCompletedSession?.status ?? rootSession.status)}
            className="flex-shrink-0"
          />
        </div>

        {/* ── Original video — full width, capped height ──────────── */}
        <div className="w-full bg-black border-b flex items-center justify-center" style={{ maxHeight: 260 }}>
          {(() => {
            const youtubeId = rootSession.original_video_url
              ? extractYoutubeId(rootSession.original_video_url)
              : null;
            return youtubeId ? (
              <iframe
                src={`https://www.youtube.com/embed/${youtubeId}`}
                className="w-full"
                style={{ height: 260 }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video
                src={rootSession.original_video_url}
                controls
                className="w-full object-contain"
                preload="metadata"
                style={{ maxHeight: 260 }}
              />
            );
          })()}
        </div>

        {/* ── Clips + footer ───────────────────────────────────────── */}
        <div className="p-5 space-y-5">

          {/* Clips grid */}
          {allClipUrls.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-4 uppercase tracking-wide flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                Generated Clips
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {allClipUrls.map((url, i) => (
                  <ClipCard key={url} clipUrl={url} index={i} globalIndex={i} />
                ))}
              </div>
            </div>
          )}

          {/* Failed state — show contextual error message + retry */}
          {latestFailedSession && !activeSession && (
            <div className="flex items-start gap-3 p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-destructive">Processing failed</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {getTranscriptionErrorMessage(latestFailedSession.error_message)}
                </p>
                {latestFailedSession.retry_count >= MAX_RETRIES ? (
                  <p className="text-xs text-muted-foreground mt-3">
                    Max retries reached.{" "}
                    <Link href="/?new=1" className="underline underline-offset-2 hover:text-foreground">
                      Re-upload the video
                    </Link>{" "}
                    to try again.
                  </p>
                ) : (
                  <>
                    {retryError && (
                      <p className="text-xs text-destructive mt-1">{retryError}</p>
                    )}
                    <div className="flex items-center gap-3 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleRetry}
                        disabled={isRetrying}
                        className="text-xs h-7"
                      >
                        <RefreshCw className={`w-3 h-3 mr-1.5 ${isRetrying ? "animate-spin" : ""}`} />
                        {isRetrying ? "Retrying…" : "Retry"}
                      </Button>
                      {latestFailedSession.retry_count > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {latestFailedSession.retry_count}/{MAX_RETRIES} attempts used
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Queued state — show position banner, no skeletons yet */}
          {!!activeSession && activeSession.status === "queued" && !isRegenerating && (
            <WorkflowProgress
              queuePosition={queuePosition}
              estimatedWaitSeconds={estimatedWaitSeconds}
            />
          )}

          {/* Skeleton placeholders while processing */}
          {!!activeSession && activeSession.status !== "queued" && (
            <div className="space-y-4">
              {isRegenerating && liveStage && (
                <WorkflowProgress currentStage={liveStage} />
              )}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-4 uppercase tracking-wide flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" />
                  {allClipUrls.length > 0 ? "Generating New Clips…" : "Generating Clips…"}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {Array.from({ length: skeletonCount }).map((_, i) => (
                    <ClipCardSkeleton key={i} index={i} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {regenError && (
            <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
              {regenError}
            </p>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-4 border-t gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 text-xs h-8"
              onClick={handleDelete}
              disabled={isRegenerating}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Delete
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowRegenerateDialog(true)}
              disabled={!canRegenerate}
              className="text-xs h-8"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Generate More Clips
            </Button>
          </div>
        </div>
      </Card>

      <RegenerateDialog
        open={showRegenerateDialog}
        onOpenChange={setShowRegenerateDialog}
        existingClipCount={allExistingClips.length}
        onConfirm={handleRegenerateConfirm}
        isLoading={isRegenerating}
      />
    </>
  );
}
