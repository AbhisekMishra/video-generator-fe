import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getCustomerPortalUrl } from "@/lib/lemonsqueezy-server";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: quota } = await supabase
    .from("user_quotas")
    .select("lemonsqueezy_subscription_id")
    .eq("user_id", user.id)
    .single();

  if (!quota?.lemonsqueezy_subscription_id) {
    return NextResponse.json({ error: "No active subscription found" }, { status: 404 });
  }

  try {
    const url = await getCustomerPortalUrl(quota.lemonsqueezy_subscription_id);
    return NextResponse.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load billing portal";
    console.error("❌ Billing portal lookup failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
