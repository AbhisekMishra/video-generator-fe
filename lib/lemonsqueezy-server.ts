import crypto from "crypto";
import { PLANS, PlanConfig, PlanTier } from "@/lib/lemonsqueezy-plans";

/**
 * Server-only Lemon Squeezy integration — plain REST calls (JSON:API) rather than the
 * official SDK, matching this project's preference for calling a vendor's HTTP API
 * directly instead of pulling in a wrapper for a handful of endpoints (see
 * video-generator-be's move from langchain to the anthropic SDK directly).
 *
 * Never import this from a "use client" component — it pulls in `crypto` and reads
 * secret env vars. Display-only plan data (price, quota) lives in
 * lib/lemonsqueezy-plans.ts instead, safe for client use.
 */

const LEMONSQUEEZY_API_BASE = "https://api.lemonsqueezy.com/v1";

/** Tier -> variant ID, read from env on every call (not cached at module load) so
 * tests can stub env vars per-case and so a runtime env change doesn't need a rebuild
 * to take effect. Set after creating the corresponding product/variant in the Lemon
 * Squeezy dashboard. */
function variantIdsByTier(): Record<PlanTier, string> {
  return {
    starter: process.env.LEMONSQUEEZY_STARTER_VARIANT_ID ?? "",
    pro: process.env.LEMONSQUEEZY_PRO_VARIANT_ID ?? "",
  };
}

export function variantIdForTier(tier: PlanTier): string {
  return variantIdsByTier()[tier];
}

export function planForVariantId(variantId: string): (PlanConfig & { variantId: string }) | null {
  const ids = variantIdsByTier();
  const tier = (Object.keys(ids) as PlanTier[]).find((t) => ids[t] === String(variantId));
  return tier ? { ...PLANS[tier], variantId: ids[tier] } : null;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is not set`);
  }
  return value;
}

/**
 * Create a Lemon Squeezy checkout for a subscription variant, with the Supabase user id
 * embedded as custom checkout data so the webhook can map the resulting subscription
 * back to a user (Lemon Squeezy echoes custom_data back on every subscription webhook).
 */
export async function createCheckout(params: {
  variantId: string;
  userId: string;
  email: string;
  redirectUrl: string;
}): Promise<string> {
  const apiKey = requireEnv("LEMONSQUEEZY_API_KEY");
  const storeId = requireEnv("LEMONSQUEEZY_STORE_ID");

  const res = await fetch(`${LEMONSQUEEZY_API_BASE}/checkouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/vnd.api+json",
      Accept: "application/vnd.api+json",
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            email: params.email,
            custom: { user_id: params.userId },
          },
          product_options: {
            redirect_url: params.redirectUrl,
          },
        },
        relationships: {
          store: { data: { type: "stores", id: storeId } },
          variant: { data: { type: "variants", id: params.variantId } },
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Lemon Squeezy checkout creation failed: ${res.status} ${body}`);
  }

  const json = await res.json();
  const url = json?.data?.attributes?.url;
  if (!url) {
    throw new Error("Lemon Squeezy checkout response missing url");
  }
  return url;
}

/** Fetch the hosted customer-portal URL for a subscription (manage/cancel/update payment). */
export async function getCustomerPortalUrl(subscriptionId: string): Promise<string> {
  const apiKey = requireEnv("LEMONSQUEEZY_API_KEY");

  const res = await fetch(`${LEMONSQUEEZY_API_BASE}/subscriptions/${subscriptionId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/vnd.api+json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Lemon Squeezy subscription fetch failed: ${res.status} ${body}`);
  }

  const json = await res.json();
  const url = json?.data?.attributes?.urls?.customer_portal;
  if (!url) {
    throw new Error("Lemon Squeezy subscription response missing customer_portal url");
  }
  return url;
}

/**
 * Verify a webhook request's signature. Lemon Squeezy signs the raw request body with
 * HMAC-SHA256 using the webhook secret, sent as the X-Signature header — must be checked
 * against the raw body text (not re-serialized JSON, which could differ byte-for-byte).
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  const secret = requireEnv("LEMONSQUEEZY_WEBHOOK_SECRET");
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(signatureHeader, "utf8");
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}
