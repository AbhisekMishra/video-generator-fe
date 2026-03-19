import { supabase as browserClient } from "./supabase";
import { v4 as uuidv4 } from "uuid";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ClipMetadata {
  start: number;
  end: number;
  title: string | null;
  score: number;
}

export interface Session {
  id: string;
  user_id: string;
  original_video_url: string;
  original_video_path: string;
  original_filename: string | null;
  original_file_size: number | null;
  original_duration: number | null;
  status: "pending" | "processing" | "completed" | "failed";
  current_stage: string | null;
  progress: number;
  thread_id: string;
  clip_paths: string[];
  caption_paths: string[];
  clips_metadata: ClipMetadata[];
  total_clips: number;
  completed_clips: number;
  error_message: string | null;
  error_stage: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

/**
 * Create a new session for video processing
 */
export async function createSession(
  params: {
    userId: string;
    filename: string;
    fileSize: number;
    filePath: string;
    publicUrl: string;
  },
  supabaseClient?: SupabaseClient
): Promise<Session> {
  const supabase = supabaseClient || browserClient;
  const threadId = `session-${uuidv4()}`;

  console.log('📝 Attempting to create session:', {
    userId: params.userId,
    filename: params.filename,
    threadId: threadId,
    usingClient: supabaseClient ? 'server' : 'browser'
  });

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      user_id: params.userId,
      original_filename: params.filename,
      original_file_size: params.fileSize,
      original_video_path: params.filePath,
      original_video_url: params.publicUrl,
      thread_id: threadId,
      status: "pending",
      progress: 0,
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Supabase error creating session:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint
    });
    throw new Error(`Failed to create session: ${error.message}`);
  }

  console.log('✅ Session created in database:', data.id);
  return data as Session;
}

/**
 * Update session progress
 */
export async function updateSessionProgress(
  sessionId: string,
  updates: {
    status?: Session["status"];
    current_stage?: string;
    progress?: number;
    total_clips?: number;
    completed_clips?: number;
    clip_paths?: string[];
    caption_paths?: string[];
    error_message?: string;
    error_stage?: string;
  },
  supabaseClient?: SupabaseClient
) {
  const supabase = supabaseClient || browserClient;
  const { data, error } = await supabase
    .from("sessions")
    .update(updates)
    .eq("id", sessionId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update session: ${error.message}`);
  }

  return data as Session;
}

/**
 * Mark session as completed
 */
export async function completeSession(
  sessionId: string,
  clipsMetadata?: ClipMetadata[],
  supabaseClient?: SupabaseClient
) {
  const supabase = supabaseClient || browserClient;
  const { data, error } = await supabase
    .from("sessions")
    .update({
      status: "completed",
      current_stage: "completed",
      progress: 100,
      completed_at: new Date().toISOString(),
      ...(clipsMetadata ? { clips_metadata: clipsMetadata } : {}),
    })
    .eq("id", sessionId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to complete session: ${error.message}`);
  }

  return data as Session;
}

/**
 * Mark session as failed
 */
export async function failSession(
  sessionId: string,
  errorMessage: string,
  errorStage?: string,
  supabaseClient?: SupabaseClient
) {
  const supabase = supabaseClient || browserClient;
  const { data, error } = await supabase
    .from("sessions")
    .update({
      status: "failed",
      error_message: errorMessage,
      error_stage: errorStage,
    })
    .eq("id", sessionId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to mark session as failed: ${error.message}`);
  }

  return data as Session;
}

/**
 * Get session by ID
 */
export async function getSession(sessionId: string, supabaseClient?: SupabaseClient): Promise<Session | null> {
  const supabase = supabaseClient || browserClient;
  console.log('🔍 Getting session with ID:', sessionId, 'using client:', supabaseClient ? 'server' : 'browser');

  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  console.log('📊 Query result:', {
    found: !!data,
    data,
    error: error ? {
      code: error.code,
      message: error.message,
      details: error.details
    } : null
  });

  if (error) {
    if (error.code === "PGRST116") {
      // Row not found
      console.log('⚠️ Session not found in database, might be RLS blocking or wrong ID');
      return null;
    }
    throw new Error(`Failed to get session: ${error.message}`);
  }

  return data as Session;
}

/**
 * Get session by thread ID
 */
export async function getSessionByThreadId(
  threadId: string,
  supabaseClient?: SupabaseClient
): Promise<Session | null> {
  const supabase = supabaseClient || browserClient;
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("thread_id", threadId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to get session by thread ID: ${error.message}`);
  }

  return data as Session;
}

/**
 * Get all sessions for a user
 */
export async function getUserSessions(
  userId: string,
  limit = 50,
  supabaseClient?: SupabaseClient
): Promise<Session[]> {
  const supabase = supabaseClient || browserClient;
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get user sessions: ${error.message}`);
  }

  return (data as Session[]) || [];
}

/**
 * Delete a session and all its files
 */
export async function deleteSession(sessionId: string, supabaseClient?: SupabaseClient) {
  const supabase = supabaseClient || browserClient;

  // Get session first to know the storage path
  const session = await getSession(sessionId, supabaseClient);
  if (!session) {
    throw new Error("Session not found");
  }

  // Delete all files from storage
  const sessionPath = `sessions/${sessionId}`;

  try {
    const { data: files } = await supabase.storage
      .from("video-storage")
      .list(sessionPath);

    if (files && files.length > 0) {
      const filePaths = files.map((file) => `${sessionPath}/${file.name}`);
      await supabase.storage.from("video-storage").remove(filePaths);
    }
  } catch (error) {
    console.error("Error deleting session files:", error);
    // Continue with session deletion even if files fail
  }

  // Delete session record (CASCADE will handle related data)
  const { error } = await supabase
    .from("sessions")
    .delete()
    .eq("id", sessionId);

  if (error) {
    throw new Error(`Failed to delete session: ${error.message}`);
  }
}

/**
 * Get all sessions for a specific original video path (used for grouping on dashboard)
 */
export async function getSessionsByVideoPath(
  videoPath: string,
  supabaseClient?: SupabaseClient
): Promise<Session[]> {
  const supabase = supabaseClient || browserClient;
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("original_video_path", videoPath)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to get sessions by video path: ${error.message}`);
  }

  return (data as Session[]) || [];
}

/**
 * Get storage path for session files
 */
export function getSessionStoragePath(sessionId: string, type: "original" | "clips" | "captions") {
  return `sessions/${sessionId}/${type}`;
}

/**
 * Get storage path for a specific clip
 */
export function getClipStoragePath(sessionId: string, clipIndex: number, extension = "mp4") {
  return `sessions/${sessionId}/clips/clip-${clipIndex}.${extension}`;
}

/**
 * Get storage path for a specific caption file
 */
export function getCaptionStoragePath(sessionId: string, clipIndex: number, extension = "srt") {
  return `sessions/${sessionId}/captions/clip-${clipIndex}.${extension}`;
}
