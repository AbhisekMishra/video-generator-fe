import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300; // 5 minutes max for processing

// This endpoint is deprecated - use /api/process-video/stream instead
// which proxies to the FastAPI backend with real-time SSE updates
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      error: "Deprecated endpoint",
      message: "Please use /api/process-video/stream for real-time processing with SSE",
    },
    { status: 410 }
  );
}
