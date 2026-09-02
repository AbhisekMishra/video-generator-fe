import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createCheckout, PLANS, PlanTier } from "@/lib/lemonsqueezy";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const plan = body.plan as PlanTier | undefined;

  if (!plan || !(plan in PLANS)) {
    return NextResponse.json({ error: "plan must be 'starter' or 'pro'" }, { status: 400 });
  }

  const planConfig = PLANS[plan];
  if (!planConfig.variantId) {
    return NextResponse.json(
      { error: `${plan} plan is not configured (missing variant ID)` },
      { status: 500 }
    );
  }

  try {
    const checkoutUrl = await createCheckout({
      variantId: planConfig.variantId,
      userId: user.id,
      email: user.email ?? "",
      redirectUrl: `${request.nextUrl.origin}/dashboard?checkout=success`,
    });
    return NextResponse.json({ url: checkoutUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create checkout";
    console.error("❌ Checkout creation failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
