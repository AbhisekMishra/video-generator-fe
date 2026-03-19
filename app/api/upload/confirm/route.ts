import { NextRequest, NextResponse } from "next/server";
import { getPublicUrl } from "@/lib/supabase";
import { supabase, STORAGE_BUCKET } from "@/lib/supabase";
import { createClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabaseServer = createClient();
    const {
      data: { user },
    } = await supabaseServer.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { filePath } = await request.json();

    if (!filePath) {
      return NextResponse.json(
        { error: "File path is required" },
        { status: 400 }
      );
    }

    // Verify the file exists in storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list(filePath.split("/").slice(0, -1).join("/"), {
        search: filePath.split("/").pop(),
      });

    if (error || !data || data.length === 0) {
      return NextResponse.json(
        { error: "File not found in storage" },
        { status: 404 }
      );
    }

    // Get public URL
    const publicUrl = getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      publicUrl,
      filePath,
    });
  } catch (error) {
    console.error("Error confirming upload:", error);
    return NextResponse.json(
      { error: "Failed to confirm upload" },
      { status: 500 }
    );
  }
}
