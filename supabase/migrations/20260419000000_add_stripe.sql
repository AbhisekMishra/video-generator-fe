-- Add Stripe customer ID to user_quotas
ALTER TABLE user_quotas ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE;

-- Update plan_tier constraint to include 'starter'
ALTER TABLE user_quotas DROP CONSTRAINT IF EXISTS user_quotas_plan_tier_check;
ALTER TABLE user_quotas ADD CONSTRAINT user_quotas_plan_tier_check
  CHECK (plan_tier IN ('free', 'starter', 'pro', 'enterprise'));

-- Allow service role to update quota (needed for webhook handler)
CREATE POLICY "Service role can update quotas"
  ON user_quotas FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- RPC: update user plan tier and reset monthly attempts (called from webhook)
CREATE OR REPLACE FUNCTION update_user_plan(
  p_user_id UUID,
  p_plan_tier TEXT,
  p_attempts_limit INTEGER,
  p_stripe_customer_id TEXT
) RETURNS void AS $$
BEGIN
  UPDATE user_quotas
  SET plan_tier = p_plan_tier,
      attempts_limit = p_attempts_limit,
      stripe_customer_id = p_stripe_customer_id,
      attempts_used = 0,
      updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: reset monthly attempts (called on subscription renewal)
CREATE OR REPLACE FUNCTION reset_monthly_attempts(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE user_quotas SET attempts_used = 0, updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: downgrade user to free when subscription is cancelled
CREATE OR REPLACE FUNCTION downgrade_user_to_free(p_stripe_customer_id TEXT)
RETURNS void AS $$
BEGIN
  UPDATE user_quotas
  SET plan_tier = 'free',
      attempts_limit = 3,
      updated_at = NOW()
  WHERE stripe_customer_id = p_stripe_customer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: reset attempts on subscription renewal (lookup by customer id)
CREATE OR REPLACE FUNCTION reset_attempts_by_customer(p_stripe_customer_id TEXT)
RETURNS void AS $$
BEGIN
  UPDATE user_quotas SET attempts_used = 0, updated_at = NOW()
  WHERE stripe_customer_id = p_stripe_customer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
