import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

export const PLANS = {
  free: { tier: "free", limit: 3, priceId: null, name: "Free", price: 0 },
  starter: {
    tier: "starter",
    limit: 20,
    priceId: process.env.STRIPE_STARTER_PRICE_ID!,
    name: "Starter",
    price: 9,
  },
  pro: {
    tier: "pro",
    limit: 100,
    priceId: process.env.STRIPE_PRO_PRICE_ID!,
    name: "Pro",
    price: 29,
  },
} as const;

export type PlanTier = keyof typeof PLANS;

/** Map a Stripe price ID to its plan config */
export function getPlanByPriceId(priceId: string) {
  return Object.values(PLANS).find((p) => p.priceId === priceId) ?? null;
}
