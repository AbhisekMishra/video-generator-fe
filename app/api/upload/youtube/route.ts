import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { v4 as uuidv4 } from "uuid";
import { getBackendUrl, backendHeaders } from "@/lib/backend";

export const dynamic = "force-dynamic";

const YOUTUBE_PATTERN =
  /(youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/live\/)/;

function isYoutubeUrl(url: string): boolean {
  return YOUTUBE_PATTERN.test(url);
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Block submission if quota is exhausted
  const { data: quota } = await supabase
    .from("user_quotas")
    .select("attempts_used, attempts_limit")
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

  const { url } = await request.json();

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  if (!isYoutubeUrl(url)) {
    return NextResponse.json(
      { error: "Invalid YouTube URL. Supported formats: youtube.com/watch, youtu.be, youtube.com/shorts" },
      { status: 400 }
    );
  }

  // Validate video duration before creating a session — keeps quota intact on rejection
  try {
    const validateRes = await fetch(`${getBackendUrl()}/validate-youtube`, {
      method: "POST",
      headers: backendHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ url }),
    });
    if (!validateRes.ok) {
      const { detail } = await validateRes.json().catch(() => ({ detail: "Video validation failed." }));
      return NextResponse.json({ error: detail }, { status: 400 });
    }
  } catch {
    // Backend unreachable — let processing fail naturally rather than blocking the user
    console.warn("Could not reach backend for YouTube validation, proceeding without duration check.");
  }

  const threadId = `session-${uuidv4()}`;

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      original_filename: "YouTube Video",
      original_file_size: null,
      original_video_path: url,
      original_video_url: url,
      thread_id: threadId,
      status: "pending",
      progress: 0,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create YouTube session:", error);
    return NextResponse.json(
      { error: `Failed to create session: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    sessionId: data.id,
    threadId: data.thread_id,
    publicUrl: url,
  });
}
