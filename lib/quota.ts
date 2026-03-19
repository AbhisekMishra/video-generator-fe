import { SupabaseClient } from "@supabase/supabase-js";

export interface UserQuota {
  plan_tier: string;
  attempts_used: number;
  attempts_limit: number;
}

export async function getUserQuota(
  supabase: SupabaseClient,
  userId: string
): Promise<UserQuota | null> {
  const { data } = await supabase
    .from("user_quotas")
    .select("plan_tier, attempts_used, attempts_limit")
    .eq("user_id", userId)
    .single();
  return data;
}

export function hasRemainingAttempts(quota: UserQuota | null): boolean {
  if (!quota) return false;
  return quota.attempts_used < quota.attempts_limit;
}
