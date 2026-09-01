import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getBackendUrl, backendHeaders } from "@/lib/backend";

beforeEach(() => {
  vi.unstubAllEnvs();
  delete process.env.FASTAPI_URL;
  delete process.env.FASTAPI_INTERNAL_API_KEY;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getBackendUrl", () => {
  it("defaults to localhost in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(getBackendUrl()).toBe("http://localhost:8000");
  });

  it("uses FASTAPI_URL when set", () => {
    process.env.FASTAPI_URL = "https://backend.example.com";
    expect(getBackendUrl()).toBe("https://backend.example.com");
  });

  it("throws in production when unset, instead of silently defaulting", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getBackendUrl()).toThrow(/FASTAPI_URL/);
  });
});

describe("backendHeaders", () => {
  it("includes the internal API key header", () => {
    process.env.FASTAPI_INTERNAL_API_KEY = "secret";
    expect(backendHeaders()["X-Internal-Api-Key"]).toBe("secret");
  });

  it("throws in production when the key is unset", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => backendHeaders()).toThrow(/FASTAPI_INTERNAL_API_KEY/);
  });
});
