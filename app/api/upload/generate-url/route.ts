import { NextRequest, NextResponse } from "next/server";
import {
  createSignedUploadUrl,
  generateVideoFileName,
} from "@/lib/supabase";
import { createClient } from "@/lib/supabase-server";

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

    const { fileName, fileType } = await request.json();

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
