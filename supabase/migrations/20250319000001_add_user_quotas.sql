-- Create user_quotas table for pricing tier enforcement
CREATE TABLE user_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_tier TEXT DEFAULT 'free' CHECK (plan_tier IN ('free', 'pro', 'enterprise')),
  attempts_used INTEGER DEFAULT 0,
  attempts_limit INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE user_quotas ENABLE ROW LEVEL SECURITY;

-- Users can read their own quota only (no self-modification allowed)
CREATE POLICY "Users can view own quota"
  ON user_quotas FOR SELECT
  USING (auth.uid() = user_id);

-- Auto-update updated_at timestamp
CREATE TRIGGER update_user_quotas_updated_at
  BEFORE UPDATE ON user_quotas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create quota row when a new user signs up
CREATE OR REPLACE FUNCTION create_user_quota_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_quotas (user_id, plan_tier, attempts_used, attempts_limit)
  VALUES (NEW.id, 'free', 0, 3);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_quota_on_signup();

-- RPC: atomically check and increment quota
-- SECURITY DEFINER bypasses RLS so users cannot self-inflate quotas
-- Atomic UPDATE with WHERE attempts_used < attempts_limit prevents race conditions
CREATE OR REPLACE FUNCTION increment_user_attempts(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE user_quotas
  SET attempts_used = attempts_used + 1,
      updated_at = NOW()
  WHERE user_id = p_user_id
    AND attempts_used < attempts_limit;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quota exceeded';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill quota rows for existing users who signed up before this migration
INSERT INTO user_quotas (user_id, plan_tier, attempts_used, attempts_limit)
SELECT id, 'free', 0, 3
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_quotas);
