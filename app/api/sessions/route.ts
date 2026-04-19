import { NextRequest, NextResponse } from "next/server";
import { getUserSessions } from "@/lib/session";
import { createClient } from "@/lib/supabase-server";
import type { Session } from "@/lib/session";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const STORAGE_BUCKET = "video-storage";

function deriveClipUrls(sessionId: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/sessions/${sessionId}/clips/clip-${i}.mp4`
  );
}

async function repairSession(session: Session, supabase: ReturnType<typeof createClient>): Promise<Session> {
  const clipCount = session.clips_metadata?.length ?? 0;
  if (clipCount === 0) return session;

  const clip_paths = deriveClipUrls(session.id, clipCount);
  const { data } = await supabase
    .from("sessions")
    .update({
      status: "completed",
      clip_paths,
      progress: 100,
      current_stage: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", session.id)
    .select()
    .single();

  return (data as Session) ?? { ...session, status: "completed", clip_paths, progress: 100, current_stage: "completed" };
}

/**
 * GET /api/sessions
 * Get all sessions for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let sessions = await getUserSessions(user.id, 50, supabase);

    // Auto-repair sessions where rendering finished (clips_metadata populated)
    // but clip_paths was never written due to the update_session_status bug.
    const repaired = await Promise.all(
      sessions.map((s) =>
        (s.clips_metadata?.length ?? 0) > 0 && (s.clip_paths?.length ?? 0) === 0
          ? repairSession(s, supabase)
          : Promise.resolve(s)
      )
    );

    return NextResponse.json({ sessions: repaired });
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}
