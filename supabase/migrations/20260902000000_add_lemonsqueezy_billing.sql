-- Add Lemon Squeezy billing support to user_quotas
--
-- Widens plan_tier to include 'starter' (matches the Starter/Pro pricing already
-- hinted at by the old, never-wired-up Stripe price IDs in .env) and adds columns to
-- track each user's Lemon Squeezy subscription so the webhook handler
-- (app/api/webhooks/lemonsqueezy) can update plan_tier/attempts_limit and reset
-- attempts_used on each successful renewal payment.

ALTER TABLE user_quotas DROP CONSTRAINT IF EXISTS user_quotas_plan_tier_check;

ALTER TABLE user_quotas
  ADD CONSTRAINT user_quotas_plan_tier_check
  CHECK (plan_tier IN ('free', 'starter', 'pro', 'enterprise'));

ALTER TABLE user_quotas ADD COLUMN IF NOT EXISTS lemonsqueezy_customer_id TEXT;
ALTER TABLE user_quotas ADD COLUMN IF NOT EXISTS lemonsqueezy_subscription_id TEXT UNIQUE;
ALTER TABLE user_quotas ADD COLUMN IF NOT EXISTS subscription_status TEXT;
ALTER TABLE user_quotas ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_quotas_lemonsqueezy_subscription_id
  ON user_quotas(lemonsqueezy_subscription_id);
