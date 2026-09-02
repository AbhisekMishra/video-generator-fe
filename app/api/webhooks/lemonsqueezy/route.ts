import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { verifyWebhookSignature, planForVariantId } from "@/lib/lemonsqueezy";

export const dynamic = "force-dynamic";

/**
 * Lemon Squeezy webhook handler. Verifies the signature against the raw body (must read
 * via request.text() before any JSON parsing — the signature won't match re-serialized
 * JSON), then updates user_quotas based on the subscription's current state.
 *
 * Returns 500 on processing failures (not swallowed) so Lemon Squeezy retries the
 * delivery — better to get a duplicate, idempotent update later than silently drop a
 * subscription change because of a transient DB error.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.error("❌ Lemon Squeezy webhook: invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const eventName: string = payload?.meta?.event_name;
  const userId: string | undefined = payload?.meta?.custom_data?.user_id;
  const attributes = payload?.data?.attributes ?? {};
  const subscriptionId: string | undefined = payload?.data?.id;

  console.log(`📩 Lemon Squeezy webhook: ${eventName}  subscription=${subscriptionId}  user=${userId ?? "none"}`);

  if (!userId) {
    // Non-subscription events (e.g. order_created without our checkout metadata) have
    // nothing to map to a user — acknowledge and move on.
    return NextResponse.json({ received: true });
  }

  const supabase = createAdminClient();

  try {
    switch (eventName) {
      case "subscription_created":
      case "subscription_updated": {
        const plan = planForVariantId(String(attributes.variant_id));
        if (!plan) {
          console.error(`❌ Lemon Squeezy webhook: unrecognized variant_id ${attributes.variant_id}`);
          break;
        }
        const isActive = ["active", "on_trial", "past_due"].includes(attributes.status);
        await supabase
          .from("user_quotas")
          .update({
            plan_tier: isActive ? plan.tier : "free",
            attempts_limit: isActive ? plan.attemptsLimit : 3,
            lemonsqueezy_customer_id: attributes.customer_id != null ? String(attributes.customer_id) : null,
            lemonsqueezy_subscription_id: subscriptionId,
            subscription_status: attributes.status,
            current_period_end: attributes.renews_at ?? null,
          })
          .eq("user_id", userId);
        break;
      }

      case "subscription_payment_success": {
        // A renewal charge succeeded — reset the monthly quota for the new cycle.
        await supabase
          .from("user_quotas")
          .update({ attempts_used: 0 })
          .eq("user_id", userId);
        break;
      }

      case "subscription_cancelled":
      case "subscription_expired": {
        await supabase
          .from("user_quotas")
          .update({
            plan_tier: "free",
            attempts_limit: 3,
            subscription_status: attributes.status,
          })
          .eq("user_id", userId);
        break;
      }

      case "subscription_payment_failed": {
        // Lemon Squeezy retries the charge automatically — just reflect the status.
        // Don't downgrade yet; subscription_expired will fire if retries are exhausted.
        await supabase
          .from("user_quotas")
          .update({ subscription_status: "past_due" })
          .eq("user_id", userId);
        break;
      }

      default:
        // Other event types (order_created, license_key_created, etc.) don't affect quota.
        break;
    }
  } catch (error) {
    console.error("❌ Lemon Squeezy webhook processing failed:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
