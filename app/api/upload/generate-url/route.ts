import { NextRequest, NextResponse } from "next/server";
import {
  createSignedUploadUrl,
  generateVideoFileName,
} from "@/lib/supabase";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const MAX_UPLOAD_SIZE_BYTES = Number(process.env.MAX_UPLOAD_SIZE_MB ?? "2048") * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Block upload if quota is exhausted
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

    const { fileName, fileType, fileSize } = await request.json();

    if (!fileName) {
      return NextResponse.json(
        { error: "File name is required" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska"];
    if (fileType && !allowedTypes.includes(fileType)) {
      return NextResponse.json(
        { error: "Invalid file type. Only MP4, MOV, AVI, and MKV are allowed." },
        { status: 400 }
      );
    }

    // Reject oversized files before we hand out an upload URL — without this, a
    // multi-GB file uploads in full to Supabase Storage before the backend's
    // duration cap gets a chance to reject it. The client already checks this too,
    // but that's bypassable, so it's enforced here as well.
    if (typeof fileSize === "number" && fileSize > MAX_UPLOAD_SIZE_BYTES) {
      const limitMb = Math.round(MAX_UPLOAD_SIZE_BYTES / (1024 * 1024));
      return NextResponse.json(
        { error: `File is too large. Maximum upload size is ${limitMb} MB.` },
        { status: 400 }
      );
    }

    // Generate unique filename
    const uniqueFileName = generateVideoFileName(fileName);

    // Create signed upload URL
    const { signedUrl, token, path } = await createSignedUploadUrl(uniqueFileName);

    return NextResponse.json({
      uploadUrl: signedUrl,
      filePath: path,
      token,
      fileName: uniqueFileName,
    });
  } catch (error) {
    console.error("Error generating signed upload URL:", error);
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
