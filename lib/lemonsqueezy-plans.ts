/**
 * Client-safe plan/quota display config — no server-only imports (crypto, fetch-to-
 * vendor-API) and no env var access, so this can be imported from "use client"
 * components (app/pricing/page.tsx) without pulling server logic or secrets into the
 * browser bundle. Variant IDs and API calls live in lib/lemonsqueezy-server.ts instead.
 */

export type PlanTier = "starter" | "pro";

export interface PlanConfig {
  tier: PlanTier;
  attemptsLimit: number;
  price: string;
  cadence: string;
  name: string;
}

/** Tier -> {quota, display price} — the single source of truth for plan display data;
 * app/pricing/page.tsx reads from this rather than duplicating it. Store currency is
 * AED. Keep this in sync with the variant IDs in lib/lemonsqueezy-server.ts. */
export const PLANS: Record<PlanTier, PlanConfig> = {
  starter: {
    tier: "starter",
    attemptsLimit: 20,
    price: "39 AED",
    cadence: "/month",
    name: "Starter",
  },
  pro: {
    tier: "pro",
    attemptsLimit: 60,
    price: "109 AED",
    cadence: "/month",
    name: "Pro",
  },
};
