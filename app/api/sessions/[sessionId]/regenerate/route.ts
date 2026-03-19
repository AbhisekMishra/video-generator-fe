import { NextRequest, NextResponse } from "next/server";
import { getSession, getSessionsByVideoPath, createSession } from "@/lib/session";
import { createClient } from "@/lib/supabase-server";

/**
 * POST /api/sessions/[sessionId]/regenerate
 *
 * Creates a new processing session reusing the same original video.
 * Collects all existing clip time ranges from every session that shares
 * the same original_video_path so the LLM avoids regenerating duplicates.
 */
export async function POST(
  request: NextRequest,
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

    // Verify the referenced session belongs to the user
    const sourceSession = await getSession(sessionId, supabase);
    if (!sourceSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (sourceSession.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Collect all clips_metadata from every session sharing the same video
    const siblings = await getSessionsByVideoPath(sourceSession.original_video_path, supabase);
    const existingClips = siblings.flatMap((s) => s.clips_metadata ?? []);

    // Create a new session reusing the same original video (no re-upload needed)
    const newSession = await createSession(
      {
        userId: user.id,
        filename: sourceSession.original_filename ?? "video.mp4",
        fileSize: sourceSession.original_file_size ?? 0,
        filePath: sourceSession.original_video_path,
        publicUrl: sourceSession.original_video_url,
      },
      supabase
    );

    return NextResponse.json({
      sessionId: newSession.id,
      threadId: newSession.thread_id,
      videoUrl: newSession.original_video_url,
      filePath: newSession.original_video_path,
      existingClips,
    });
  } catch (error) {
    console.error("Error creating regeneration session:", error);
    return NextResponse.json(
      { error: "Failed to create regeneration session" },
      { status: 500 }
    );
  }
}
