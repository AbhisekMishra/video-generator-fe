import { NextRequest } from "next/server";
import {
  updateSessionProgress,
  completeSession,
  failSession,
  getSession,
  type ClipMetadata,
} from "@/lib/session";
import { createClient } from "@/lib/supabase-server";

export const maxDuration = 300; // 5 minutes max for processing

const BACKEND_URL = process.env.FASTAPI_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  // Get authenticated user
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const body = await request.json();
  const { sessionId, threadId, videoUrl, filePath, existingClips } = body;

  if (!sessionId || !threadId) {
    return new Response(
      JSON.stringify({ error: "sessionId and threadId are required" }),
      { status: 400 }
    );
  }

  if (!videoUrl) {
    return new Response(
      JSON.stringify({ error: "videoUrl is required" }),
      { status: 400 }
    );
  }

  // Verify session belongs to authenticated user
  const session = await getSession(sessionId, supabase);

  console.log('🔍 Session ownership check:', {
    sessionId,
    sessionExists: !!session,
    sessionUserId: session?.user_id,
    currentUserId: user.id,
    match: session?.user_id === user.id
  });

  if (!session) {
    console.error('❌ Session not found:', sessionId);
    return new Response(JSON.stringify({ error: "Session not found" }), {
      status: 404,
    });
  }

  if (session.user_id !== user.id) {
    console.error('❌ Session ownership mismatch:', {
      sessionUserId: session.user_id,
      currentUserId: user.id
    });
    return new Response(JSON.stringify({ error: "Forbidden - Session does not belong to user" }), {
      status: 403,
    });
  }

  // Check quota before processing
  const { data: quota } = await supabase
    .from("user_quotas")
    .select("attempts_used, attempts_limit, plan_tier")
    .eq("user_id", user.id)
    .single();

  if (!quota || quota.attempts_used >= quota.attempts_limit) {
    return new Response(
      JSON.stringify({
        error: `You have used all ${quota?.attempts_limit ?? 3} free attempts. Upgrade to continue.`,
        upgradeRequired: true,
      }),
      { status: 402 }
    );
  }

  // Atomically increment attempts_used before processing starts
  const { error: incrementError } = await supabase.rpc("increment_user_attempts", {
    p_user_id: user.id,
  });

  if (incrementError) {
    console.error('❌ Failed to increment quota:', incrementError);
    return new Response(
      JSON.stringify({ error: "Quota check failed. Please try again.", upgradeRequired: true }),
      { status: 402 }
    );
  }

  // Create a readable stream
  const encoder = new TextEncoder();
  const supabaseClient = supabase; // Capture for use in stream
  const stream = new ReadableStream({
    async start(controller) {
      try {
        console.log(`🚀 Starting video processing for session: ${sessionId}`);

        // Update session to processing
        await updateSessionProgress(sessionId, {
          status: "processing",
          current_stage: "transcribe",
          progress: 10,
        }, supabaseClient);

        // Step 1: Start the workflow in FastAPI backend
        console.log('📤 Calling FastAPI /process-video endpoint...');
        const startResponse = await fetch(`${BACKEND_URL}/process-video`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            video_url: videoUrl,
            session_id: sessionId,
            existing_clips: existingClips ?? [],
          }),
        });

        if (!startResponse.ok) {
          const errorData = await startResponse.json();
          throw new Error(`Failed to start workflow: ${errorData.detail || startResponse.statusText}`);
        }

        const startResult = await startResponse.json();
        console.log('✅ Workflow started:', startResult);

        // Step 2: Connect to SSE stream from FastAPI backend
        console.log('📡 Connecting to FastAPI SSE stream...');
        const sseResponse = await fetch(
          `${BACKEND_URL}/process-video/stream?session_id=${sessionId}`,
          {
            method: "GET",
            headers: {
              "Accept": "text/event-stream",
            },
          }
        );

        if (!sseResponse.ok) {
          throw new Error(`Failed to connect to SSE stream: ${sseResponse.statusText}`);
        }

        // Read the SSE stream from FastAPI
        const reader = sseResponse.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error("No response stream from backend");
        }

        console.log('✅ Connected to SSE stream');

        // Timeout mechanism to detect hung connections
        let lastEventTime = Date.now();
        const READ_TIMEOUT = 120000; // 2 minutes without any data = connection dead

        while (true) {
          // Add timeout to reader.read()
          const readPromise = reader.read();
          const timeoutPromise = new Promise<{ done: true; value: undefined }>((_, reject) => {
            setTimeout(() => {
              const timeSinceLastEvent = Date.now() - lastEventTime;
              if (timeSinceLastEvent > READ_TIMEOUT) {
                reject(new Error(`SSE stream timeout - no data received for ${READ_TIMEOUT / 1000}s`));
              }
            }, READ_TIMEOUT);
          });

          const { done, value } = await Promise.race([readPromise, timeoutPromise]);

          if (done) {
            console.log('📡 SSE stream ended by backend');
            break;
          }

          lastEventTime = Date.now(); // Reset timeout on any data received

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("event:")) {
              const eventType = line.slice(7).trim();

              // Read the next line for data
              continue;
            }

            if (line.startsWith("data:")) {
              const dataStr = line.slice(6).trim();

              // Skip empty data lines
              if (!dataStr) continue;

              let eventData;
              try {
                eventData = JSON.parse(dataStr);
              } catch (parseError) {
                console.error('❌ Failed to parse SSE data:', dataStr);
                console.error('Parse error:', parseError);
                // Send error to frontend
                const errorMessage = `data: ${JSON.stringify({
                  error: "Backend sent invalid data format",
                  sessionId: sessionId,
                })}\n\n`;
                controller.enqueue(encoder.encode(errorMessage));
                throw new Error("Invalid SSE data format from backend");
              }

              console.log('📥 SSE event:', eventData);

              // Update session progress based on current stage
              if (eventData.currentStage) {
                const stageProgress: Record<string, number> = {
                  transcribe: 20,
                  identifyClips: 40,
                  generateCaptions: 60,
                  render: 80,
                  completed: 100,
                };

                const updates: any = {
                  current_stage: eventData.currentStage,
                  progress: stageProgress[eventData.currentStage] || 0,
                };

                // Update clip counts
                if (eventData.clips) {
                  updates.total_clips = eventData.clips.length;
                }

                if (eventData.renderedVideos) {
                  updates.completed_clips = eventData.renderedVideos.length;
                  updates.clip_paths = eventData.renderedVideos.map((v: any) => v.url);
                }

                // Update session
                await updateSessionProgress(sessionId, updates, supabaseClient);
              }

              // Transform FastAPI SSE format to frontend format
              let transformedData;
              if (eventData.isComplete) {
                // Completion event — persist clips_metadata from rendered video clip data
                const clipsMetadata: ClipMetadata[] = (eventData.renderedVideos ?? [])
                  .filter((v: any) => v.clip)
                  .map((v: any) => ({
                    start: v.clip.start,
                    end: v.clip.end,
                    title: v.clip.title ?? null,
                    score: v.clip.score ?? 0,
                  }));
                await completeSession(sessionId, clipsMetadata, supabaseClient);
                transformedData = {
                  status: "completed",
                  sessionId: sessionId,
                  state: {
                    renderedVideos: eventData.renderedVideos,
                  },
                };
              } else if (eventData.errors && eventData.errors.length > 0) {
                // Error event
                await failSession(sessionId, eventData.errors.join(", "), "unknown", supabaseClient);
                transformedData = {
                  error: eventData.errors.join(", "),
                  sessionId: sessionId,
                };
              } else {
                // Regular status update - map to node format for compatibility
                const stageNodeMap: Record<string, string> = {
                  identifyClips: "identifyClips",
                  generateCaptions: "generateCaptions",
                  render: "render",
                  transcribe: "transcribe",
                  completed: "completed",
                };

                transformedData = {
                  node: stageNodeMap[eventData.currentStage] || eventData.currentStage,
                  state: {
                    currentStage: eventData.currentStage,
                    clips: eventData.clips,
                    captions: eventData.captions,
                    renderedVideos: eventData.renderedVideos,
                  },
                  sessionId: sessionId,
                  timestamp: new Date().toISOString(),
                };
              }

              // Forward to frontend in SSE format
              const message = `data: ${JSON.stringify(transformedData)}\n\n`;
              controller.enqueue(encoder.encode(message));

              // Break if completed or error
              if (eventData.isComplete || (eventData.errors && eventData.errors.length > 0)) {
                controller.close();
                return;
              }
            }
          }
        }

        console.log('⚠️ Stream ended without explicit completion event');
        // If we reach here, the stream ended but we never got a completion or error event
        // This likely means the backend crashed or disconnected unexpectedly
        await failSession(sessionId, "Backend stream ended unexpectedly", "unknown", supabaseClient);
        const unexpectedEndMessage = `data: ${JSON.stringify({
          error: "Processing interrupted - backend connection lost",
          sessionId: sessionId,
        })}\n\n`;
        controller.enqueue(encoder.encode(unexpectedEndMessage));
        controller.close();
      } catch (error) {
        console.log(error);
        const errorMsg =
          error instanceof Error ? error.message : "Unknown error";
        console.error("❌ Processing error:", errorMsg);

        // Mark session as failed
        try {
          await failSession(sessionId, errorMsg, "unknown", supabaseClient);
        } catch (e) {
          console.error("Failed to update session status:", e);
        }

        // Send error to frontend (only if controller is still active)
        try {
          const errorMessage = `data: ${JSON.stringify({
            error: errorMsg,
            sessionId: sessionId,
          })}\n\n`;
          controller.enqueue(encoder.encode(errorMessage));
        } catch (enqueueError) {
          console.error("Failed to send error to frontend (stream may be closed):", enqueueError);
        } finally {
          try {
            controller.close();
          } catch (closeError) {
            console.error("Failed to close stream:", closeError);
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
