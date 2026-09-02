"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { SessionGroupCard } from "@/components/session-group-card";
import { Button } from "@/components/ui/button";
import { Sparkles, Upload, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { AuthModal } from "@/components/auth-modal";
import type { Session } from "@/lib/session";

const POLL_INTERVAL_MS = 5000;

/** Group a flat list of sessions by original_video_path */
function groupByVideo(sessions: Session[]): Session[][] {
  const map = new Map<string, Session[]>();
  for (const s of sessions) {
    const key = s.original_video_path;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  // Each group sorted oldest→newest; groups sorted newest-first by root session
  return Array.from(map.values())
    .map((group) => group.sort((a, b) => a.created_at.localeCompare(b.created_at)))
    .sort((a, b) => b[0].created_at.localeCompare(a[0].created_at));
}

interface QueueInfo {
  queue_position: number;
  estimated_wait_seconds: number;
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [queuePositions, setQueuePositions] = useState<Record<string, QueueInfo>>({});
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchSessions = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/sessions", { signal: abortControllerRef.current?.signal });
      if (!res.ok) throw new Error("Failed to load videos");
      const { sessions: data } = await res.json();
      const list: Session[] = data ?? [];
      if (list.length === 0) {
        router.replace("/");
        return;
      }
      setSessions(list);
      return list;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setFetchError(err instanceof Error ? err.message : "Failed to load videos");
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [router]);

  const fetchQueuePositions = useCallback(async (list: Session[]) => {
    const queuedSessions = list.filter((s) => s.status === "queued");
    if (queuedSessions.length === 0) return;

    const results = await Promise.allSettled(
      queuedSessions.map((s) =>
        fetch(`/api/queue-position/${s.id}`, { signal: abortControllerRef.current?.signal })
          .then((r) => r.json())
          .then((data) => ({ id: s.id, data }))
      )
    );

    setQueuePositions((prev) => {
      const next = { ...prev };
      for (const r of results) {
        if (r.status === "fulfilled" && r.value.data?.queue_position) {
          next[r.value.id] = {
            queue_position: r.value.data.queue_position,
            estimated_wait_seconds: r.value.data.estimated_wait_seconds ?? 0,
          };
        }
      }
      return next;
    });
  }, []);

  // Poll while any session is still queued/processing/pending
  const schedulePoll = useCallback(
    (list: Session[]) => {
      const hasInProgress = list.some(
        (s) => s.status === "queued" || s.status === "processing" || s.status === "pending"
      );
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      if (!hasInProgress) return;

      pollTimerRef.current = setTimeout(async () => {
        const updated = await fetchSessions(true);
        if (updated) {
          await fetchQueuePositions(updated);
          schedulePoll(updated);
        }
      }, POLL_INTERVAL_MS);
    },
    [fetchSessions, fetchQueuePositions]
  );

  useEffect(() => {
    abortControllerRef.current = new AbortController();

    if (!authLoading) {
      if (user) {
        fetchSessions().then((list) => {
          if (list) {
            fetchQueuePositions(list);
            schedulePoll(list);
          }
        });
      } else {
        setIsLoading(false);
      }
    }
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      abortControllerRef.current?.abort();
    };
  }, [user, authLoading, fetchSessions, fetchQueuePositions, schedulePoll]);

  const handleDelete = useCallback(async (sessionId: string) => {
    // Optimistically remove all sessions for the same video path
    const target = sessions.find((s) => s.id === sessionId);
    if (!target) return;

    setSessions((prev) =>
      prev.filter((s) => s.original_video_path !== target.original_video_path)
    );

    try {
      // Delete each session in the group
      const siblings = sessions.filter(
        (s) => s.original_video_path === target.original_video_path
      );
      await Promise.all(
        siblings.map((s) =>
          fetch(`/api/sessions/${s.id}`, { method: "DELETE" })
        )
      );
    } catch {
      // Re-fetch on failure to restore correct state
      fetchSessions();
    }
  }, [sessions, fetchSessions]);

  const handleRegenerateComplete = useCallback((newSession: Session) => {
    setSessions((prev) => {
      const next = [...prev, newSession];
      // Resume polling — the group's previous sessions may all have been
      // completed/failed already, so the poll loop could otherwise be idle.
      schedulePoll(next);
      return next;
    });
  }, [schedulePoll]);

  const handleRetry = useCallback(async (_sessionId: string) => {
    const updated = await fetchSessions(true);
    if (updated) {
      await fetchQueuePositions(updated);
      schedulePoll(updated);
    }
  }, [fetchSessions, fetchQueuePositions, schedulePoll]);

  const videoGroups = groupByVideo(sessions);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
      <Navbar onSignInClick={() => setShowAuthModal(true)} />

      <main className="container mx-auto px-4 py-8 max-w-7xl flex-1">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8 gap-4">
          <div className="min-w-0 flex flex-col justify-center">
            <h1 className="text-2xl font-bold tracking-tight leading-tight">My Videos</h1>
            {videoGroups.length > 0 && (
              <p className="text-sm text-muted-foreground mt-1 leading-tight">
                {videoGroups.length} video{videoGroups.length !== 1 ? "s" : ""} · {sessions.filter((s) => s.status === "completed").flatMap((s) => s.clip_paths ?? []).length} clips generated
              </p>
            )}
          </div>
          <Button asChild className="flex-shrink-0 h-9 px-4 text-sm">
            <Link href="/?new=1">
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Upload New
            </Link>
          </Button>
        </div>

        {/* Auth gate */}
        {!authLoading && !user && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Sign in to view your videos</h2>
            <p className="text-sm text-muted-foreground mb-5 max-w-xs">
              Your generated clips are saved to your account. Sign in to access them.
            </p>
            <Button onClick={() => setShowAuthModal(true)}>Sign In</Button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-24">
            <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error state */}
        {fetchError && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <p className="text-sm text-destructive">{fetchError}</p>
            <Button variant="outline" size="sm" onClick={() => fetchSessions().then((l) => { if (l) schedulePoll(l); })}>
              Try again
            </Button>
          </div>
        )}

        {/* Video groups */}
        {!isLoading && videoGroups.length > 0 && (
          <div className="flex flex-col gap-6">
            {videoGroups.map((group) => {
              const queuedSession = group.find((s) => s.status === "queued");
              const queueInfo = queuedSession ? queuePositions[queuedSession.id] : undefined;
              return (
              <SessionGroupCard
                key={group[0].original_video_path}
                sessions={group}
                onDelete={handleDelete}
                onRegenerateComplete={handleRegenerateComplete}
                onRetry={handleRetry}
                queuePosition={queueInfo?.queue_position}
                estimatedWaitSeconds={queueInfo?.estimated_wait_seconds}
              />
            );
            })}
          </div>
        )}
      </main>

      <footer className="border-t mt-16 py-8">
        <div className="container mx-auto px-4 max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} ClipAI. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/refund" className="hover:text-foreground">Refunds</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
