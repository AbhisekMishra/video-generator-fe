import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

import { updateSessionProgress, failSession, getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase-server";
import { getBackendUrl, backendHeaders } from "@/lib/backend";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { sessionId, threadId, videoUrl, filePath, existingClips } = body;

  if (!sessionId || !threadId) {
    return NextResponse.json(
      { error: "sessionId and threadId are required" },
      { status: 400 }
    );
  }

  if (!videoUrl) {
    return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
  }

  const session = await getSession(sessionId, supabase);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.user_id !== user.id) {
    return NextResponse.json(
      { error: "Forbidden - Session does not belong to user" },
      { status: 403 }
    );
  }

  // Check quota
  const { data: quota } = await supabase
    .from("user_quotas")
    .select("attempts_used, attempts_limit, plan_tier")
    .eq("user_id", user.id)
    .single();

  if (!quota || quota.attempts_used >= quota.attempts_limit) {
    return NextResponse.json(
      {
        error: `You have used all ${quota?.attempts_limit ?? 3} free attempts. Upgrade to continue.`,
        upgradeRequired: true,
      },
      { status: 402 }
    );
  }

  // Atomically increment quota before dispatching
  const { error: incrementError } = await supabase.rpc("increment_user_attempts", {
    p_user_id: user.id,
  });

  if (incrementError) {
    console.error("❌ Failed to increment quota:", incrementError);
    return NextResponse.json(
      { error: "Quota check failed. Please try again.", upgradeRequired: true },
      { status: 402 }
    );
  }

  // Enqueue the job — backend queues it and returns position
  try {
    await updateSessionProgress(
      sessionId,
      { status: "queued", current_stage: null, progress: 0 },
      supabase
    );

    console.log(`🚀 Enqueuing video processing for session: ${sessionId}`);
    const startResponse = await fetch(`${getBackendUrl()}/process-video`, {
      method: "POST",
      headers: backendHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        video_url: videoUrl,
        session_id: sessionId,
        user_id: user.id,
        existing_clips: existingClips ?? [],
      }),
    });

    if (startResponse.status === 429) {
      // User already has an active job — revert session status and give back the
      // attempt we charged above, since no new job was actually enqueued.
      await updateSessionProgress(sessionId, { status: "pending" }, supabase).catch(() => {});
      try {
        await supabase.rpc("decrement_user_attempts", { p_user_id: user.id });
      } catch {
        // Non-fatal — worst case the user's quota is off by one, not a broken request.
      }
      const errorData = await startResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.detail || "You already have a job in progress. Please wait." },
        { status: 429 }
      );
    }

    if (!startResponse.ok) {
      const errorData = await startResponse.json().catch(() => ({}));
      throw new Error(errorData.detail || startResponse.statusText);
    }

    const { queue_position, estimated_wait_seconds } = await startResponse.json();
    console.log(`✅ Job queued at position ${queue_position} for session: ${sessionId}`);

    return NextResponse.json(
      { message: "Job queued", sessionId, queue_position, estimated_wait_seconds },
      { status: 202 }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Failed to enqueue processing:", errorMsg);

    await failSession(sessionId, errorMsg, "unknown", supabase).catch(() => {});
    // No job was actually enqueued — give back the attempt we charged above.
    try {
      await supabase.rpc("decrement_user_attempts", { p_user_id: user.id });
    } catch {
      // Non-fatal — worst case the user's quota is off by one, not a broken request.
    }
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
