import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

import { updateSessionProgress, failSession, getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase-server";

export const maxDuration = 60;

const BACKEND_URL = process.env.FASTAPI_URL || "http://localhost:8000";

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

  // Dispatch to FastAPI — fire and forget, backend processes async
  try {
    await updateSessionProgress(
      sessionId,
      { status: "processing", current_stage: "transcribe", progress: 10 },
      supabase
    );

    console.log(`🚀 Dispatching video processing for session: ${sessionId}`);
    const startResponse = await fetch(`${BACKEND_URL}/process-video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        video_url: videoUrl,
        session_id: sessionId,
        existing_clips: existingClips ?? [],
      }),
    });

    if (!startResponse.ok) {
      const errorData = await startResponse.json().catch(() => ({}));
      throw new Error(errorData.detail || startResponse.statusText);
    }

    console.log(`✅ Processing accepted by backend for session: ${sessionId}`);
    return NextResponse.json({ message: "Processing started", sessionId }, { status: 202 });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Failed to dispatch processing:", errorMsg);

    await failSession(sessionId, errorMsg, "unknown", supabase).catch(() => {});
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
