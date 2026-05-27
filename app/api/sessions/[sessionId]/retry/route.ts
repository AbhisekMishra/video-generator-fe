import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.FASTAPI_URL || "http://localhost:8000";

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

    // Reset session to queued state, clearing error fields
    const { error: resetError } = await supabase
      .from("sessions")
      .update({
        status: "queued",
        current_stage: null,
        progress: 0,
        error_message: null,
        error_stage: null,
      })
      .eq("id", sessionId);

    if (resetError) {
      console.error("Failed to reset session:", resetError);
      return NextResponse.json({ error: "Failed to reset session" }, { status: 500 });
    }

    // Enqueue job on the backend — no quota increment for retries
    const backendRes = await fetch(`${BACKEND_URL}/process-video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        video_url: session.original_video_url,
        session_id: sessionId,
        user_id: user.id,
        existing_clips: [],
      }),
    });

    if (backendRes.status === 429) {
      await supabase
        .from("sessions")
        .update({ status: "failed" })
        .eq("id", sessionId)
        .catch(() => {});
      const err = await backendRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.detail || "You already have a job in progress. Please wait." },
        { status: 429 }
      );
    }

    if (!backendRes.ok) {
      const err = await backendRes.json().catch(() => ({}));
      await supabase
        .from("sessions")
        .update({ status: "failed" })
        .eq("id", sessionId)
        .catch(() => {});
      return NextResponse.json(
        { error: err.detail || "Failed to enqueue retry" },
        { status: 500 }
      );
    }

    const { queue_position, estimated_wait_seconds } = await backendRes.json();
    console.log(`♻️  Retry queued for session ${sessionId} at position ${queue_position}`);

    return NextResponse.json(
      { message: "Retry queued", sessionId, queue_position, estimated_wait_seconds },
      { status: 202 }
    );
  } catch (error) {
    console.error("Error retrying session:", error);
    return NextResponse.json({ error: "Failed to retry session" }, { status: 500 });
  }
}
