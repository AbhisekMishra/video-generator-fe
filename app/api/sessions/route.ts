import { NextRequest, NextResponse } from "next/server";
import { getUserSessions } from "@/lib/session";
import { createClient } from "@/lib/supabase-server";

/**
 * GET /api/sessions
 * Get all sessions for the current user
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user from Supabase
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessions = await getUserSessions(user.id, 50, supabase);

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}
