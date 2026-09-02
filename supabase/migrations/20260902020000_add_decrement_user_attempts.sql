-- decrement_user_attempts: counterpart to increment_user_attempts, used when a job that
-- was already charged an attempt fails to actually enqueue (backend unreachable, 429
-- duplicate-job race) so the user doesn't lose an attempt for a video that never
-- processed — see app/api/process-video/stream/route.ts. Floors at 0 rather than
-- going negative.
CREATE OR REPLACE FUNCTION decrement_user_attempts(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE user_quotas
  SET attempts_used = GREATEST(attempts_used - 1, 0),
      updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$;

-- Harden existing SECURITY DEFINER functions with a fixed search_path (flagged by the
-- Supabase security advisor during the 2026-09 production-readiness audit — without
-- this, a role that can create objects in a schema earlier in the caller's
-- search_path could shadow a function/table these definer-privileged functions rely
-- on). Behavior is unchanged; only the search_path is now pinned.
CREATE OR REPLACE FUNCTION increment_user_attempts(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION create_user_quota_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_quotas (user_id, plan_tier, attempts_used, attempts_limit)
  VALUES (NEW.id, 'free', 0, 3);
  RETURN NEW;
END;
$$;
