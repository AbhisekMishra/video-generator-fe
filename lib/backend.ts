/**
 * Shared helpers for calling the FastAPI backend. Centralizing this avoids each
 * route independently hand-rolling `process.env.FASTAPI_URL || "http://localhost:8000"`
 * — that fallback is fine for local dev, but silently defaulting to localhost in a
 * real deployment (a misconfigured env var) fails in a very confusing way. In
 * production, missing config throws loudly instead.
 */

export function getBackendUrl(): string {
  const url = process.env.FASTAPI_URL;
  if (url) return url;
  if (process.env.NODE_ENV === "production") {
    throw new Error("FASTAPI_URL environment variable is not set");
  }
  return "http://localhost:8000";
}

export function backendHeaders(extra?: Record<string, string>): Record<string, string> {
  const key = process.env.FASTAPI_INTERNAL_API_KEY;
  if (!key && process.env.NODE_ENV === "production") {
    throw new Error("FASTAPI_INTERNAL_API_KEY environment variable is not set");
  }
  return {
    "X-Internal-Api-Key": key ?? "",
    ...extra,
  };
}
