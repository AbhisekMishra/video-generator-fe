import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Please check your .env.local file."
  );
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

export const STORAGE_BUCKET = "video-storage";

/**
 * Generate a unique filename for video upload
 */
export function generateVideoFileName(originalName: string): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const extension = originalName.split(".").pop();
  return `${timestamp}-${randomString}.${extension}`;
}

/**
 * Get public URL for an uploaded file
 */
export function getPublicUrl(filePath: string): string {
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

/**
 * Create a signed upload URL
 */
export async function createSignedUploadUrl(
  filePath: string,
  expiresIn: number = 3600
) {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUploadUrl(filePath, {
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to create signed upload URL: ${error.message}`);
  }

  return data;
}

/**
 * Delete a file from storage
 */
export async function deleteFile(filePath: string) {
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([filePath]);

  if (error) {
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}
