import { NextRequest, NextResponse } from "next/server";
import { stripe, getPlanByPriceId } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase-admin";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      if (!userId || session.mode !== "subscription") break;

      const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
      const priceId = subscription.items.data[0]?.price.id;
      const plan = priceId ? getPlanByPriceId(priceId) : null;
      if (!plan) break;

      await supabase.rpc("update_user_plan", {
        p_user_id: userId,
        p_plan_tier: plan.tier,
        p_attempts_limit: plan.limit,
        p_stripe_customer_id: session.customer as string,
      });
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.user_id;
      if (!userId) break;

      const priceId = subscription.items.data[0]?.price.id;
      const plan = priceId ? getPlanByPriceId(priceId) : null;
      if (!plan) break;

      if (subscription.status === "active") {
        await supabase.rpc("update_user_plan", {
          p_user_id: userId,
          p_plan_tier: plan.tier,
          p_attempts_limit: plan.limit,
          p_stripe_customer_id: subscription.customer as string,
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await supabase.rpc("downgrade_user_to_free", {
        p_stripe_customer_id: subscription.customer as string,
      });
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      // Reset monthly attempts on subscription renewal (not initial payment)
      if (invoice.billing_reason === "subscription_cycle") {
        await supabase.rpc("reset_attempts_by_customer", {
          p_stripe_customer_id: invoice.customer as string,
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
