import crypto from "crypto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { verifyWebhookSignature, planForVariantId } from "@/lib/lemonsqueezy-server";

const SECRET = "test-webhook-secret";

function signBody(body: string, secret: string = SECRET): string {
  return crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

beforeEach(() => {
  process.env.LEMONSQUEEZY_WEBHOOK_SECRET = SECRET;
});

afterEach(() => {
  delete process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  delete process.env.LEMONSQUEEZY_STARTER_VARIANT_ID;
});

describe("verifyWebhookSignature", () => {
  it("accepts a correctly signed body", () => {
    const body = JSON.stringify({ meta: { event_name: "subscription_created" } });
    expect(verifyWebhookSignature(body, signBody(body))).toBe(true);
  });

  it("rejects a body signed with the wrong secret", () => {
    const body = JSON.stringify({ meta: { event_name: "subscription_created" } });
    expect(verifyWebhookSignature(body, signBody(body, "wrong-secret"))).toBe(false);
  });

  it("rejects a tampered body that doesn't match its signature", () => {
    const original = JSON.stringify({ meta: { event_name: "subscription_created" } });
    const signature = signBody(original);
    const tampered = JSON.stringify({ meta: { event_name: "subscription_cancelled" } });
    expect(verifyWebhookSignature(tampered, signature)).toBe(false);
  });

  it("rejects a missing signature header", () => {
    const body = JSON.stringify({ meta: { event_name: "subscription_created" } });
    expect(verifyWebhookSignature(body, null)).toBe(false);
  });
});

describe("planForVariantId", () => {
  it("returns null for an unrecognized variant id", () => {
    expect(planForVariantId("does-not-exist")).toBeNull();
  });

  it("finds the matching plan by variant id", () => {
    process.env.LEMONSQUEEZY_STARTER_VARIANT_ID = "12345";
    expect(planForVariantId("12345")?.tier).toBe("starter");
  });
});
