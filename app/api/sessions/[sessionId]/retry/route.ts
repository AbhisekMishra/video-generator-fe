import { NextRequest, NextResponse } from "next/server";
import { getSession, failSession } from "@/lib/session";
import { createClient } from "@/lib/supabase-server";
import { getBackendUrl, backendHeaders } from "@/lib/backend";

export const dynamic = "force-dynamic";

const MAX_RETRIES = parseInt(process.env.MAX_SESSION_RETRIES ?? "3", 10);

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await params;

    const session = await getSession(sessionId, supabase);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (session.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (session.status !== "failed") {
      return NextResponse.json(
        { error: "Only failed sessions can be retried" },
        { status: 400 }
      );
    }
    if (session.retry_count >= MAX_RETRIES) {
      return NextResponse.json(
        { error: "Max retries reached", maxRetriesReached: true },
        { status: 429 }
      );
    }

    // Reset session and increment retry_count atomically
    const { error: resetError } = await supabase
      .from("sessions")
      .update({
        status: "queued",
        current_stage: null,
        progress: 0,
        error_message: null,
        error_stage: null,
        retry_count: session.retry_count + 1,
      })
      .eq("id", sessionId);

    if (resetError) {
      console.error("Failed to reset session:", resetError);
      return NextResponse.json({ error: "Failed to reset session" }, { status: 500 });
    }

    // Enqueue job on the backend — no quota increment for retries
    try {
      const backendRes = await fetch(`${getBackendUrl()}/process-video`, {
        method: "POST",
        headers: backendHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          video_url: session.original_video_url,
          session_id: sessionId,
          user_id: user.id,
          existing_clips: [],
        }),
      });

      if (backendRes.status === 429) {
        try { await supabase.from("sessions").update({ status: "failed", retry_count: session.retry_count }).eq("id", sessionId); } catch {}
        const err = await backendRes.json().catch(() => ({}));
        return NextResponse.json(
          { error: err.detail || "You already have a job in progress. Please wait." },
          { status: 429 }
        );
      }

      if (!backendRes.ok) {
        const err = await backendRes.json().catch(() => ({}));
        throw new Error(err.detail || backendRes.statusText || "Failed to enqueue retry");
      }

      const { queue_position, estimated_wait_seconds } = await backendRes.json();
      console.log(`♻️  Retry ${session.retry_count + 1}/${MAX_RETRIES} queued for session ${sessionId} at position ${queue_position}`);

      return NextResponse.json(
        { message: "Retry queued", sessionId, queue_position, estimated_wait_seconds, retriesRemaining: MAX_RETRIES - (session.retry_count + 1) },
        { status: 202 }
      );
    } catch (enqueueError) {
      // Network-level failures (backend unreachable, timeout, DNS) throw here rather than
      // resolving with a bad status — without this catch the session was left stuck at
      // "queued" forever with no job ever created and no way to retry again.
      const errorMsg = enqueueError instanceof Error ? enqueueError.message : "Failed to enqueue retry";
      console.error("Failed to enqueue retry:", errorMsg);
      await failSession(sessionId, errorMsg, "unknown", supabase).catch(() => {});
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
  } catch (error) {
    console.error("Error retrying session:", error);
    return NextResponse.json({ error: "Failed to retry session" }, { status: 500 });
  }
}
