-- sessions: RLS was defined in the original migration (20250101000000) but was found
-- disabled live in production (2026-09-02 audit) — the anon key shipped to every
-- browser had full read/write/delete access to every user's sessions via Supabase's
-- REST API, completely bypassing the ownership checks in the Next.js API routes.
-- Re-enable it with the same ownership policies. Service-role writes (the FastAPI
-- backend, the Lemon Squeezy webhook's admin client) bypass RLS automatically at the
-- Postgres level and are unaffected.
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own sessions" ON sessions;
CREATE POLICY "Users can view own sessions"
  ON sessions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create sessions" ON sessions;
CREATE POLICY "Users can create sessions"
  ON sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sessions" ON sessions;
CREATE POLICY "Users can update own sessions"
  ON sessions FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own sessions" ON sessions;
CREATE POLICY "Users can delete own sessions"
  ON sessions FOR DELETE
  USING (auth.uid() = user_id);

-- job_queue: RLS was deliberately disabled in the backend repo's migration
-- 002_fix_job_queue_rls.sql after an old supabase-py version appeared not to bypass
-- RLS on INSERT. In doing so it also removed the *only* protection the table had from
-- the public internet — the service-role key always bypasses RLS at the Postgres
-- level regardless of policies, so disabling RLS didn't just stop blocking the
-- backend, it opened the entire queue (every user's session_id, payload, status) to
-- anyone holding the anon key. Re-enabled here with only a SELECT policy — the
-- frontend never queries this table directly today, but this keeps the door open for
-- a future feature without ever granting INSERT/UPDATE/DELETE to anon/authenticated.
-- Verified live (2026-09-02): a real job enqueue/process/fail cycle completed
-- successfully after this change, confirming the backend's service-role client still
-- bypasses RLS correctly on this Postgres/supabase-py version.
ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own jobs" ON job_queue;
CREATE POLICY "Users can read own jobs"
  ON job_queue FOR SELECT
  USING (auth.uid() = user_id);
