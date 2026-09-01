import { describe, it, expect } from "vitest";
import { hasRemainingAttempts, type UserQuota } from "@/lib/quota";

describe("hasRemainingAttempts", () => {
  it("returns false for null quota", () => {
    expect(hasRemainingAttempts(null)).toBe(false);
  });

  it("returns true when attempts remain", () => {
    const quota: UserQuota = { plan_tier: "free", attempts_used: 1, attempts_limit: 3 };
    expect(hasRemainingAttempts(quota)).toBe(true);
  });

  it("returns false when quota is exhausted", () => {
    const quota: UserQuota = { plan_tier: "free", attempts_used: 3, attempts_limit: 3 };
    expect(hasRemainingAttempts(quota)).toBe(false);
  });
});
