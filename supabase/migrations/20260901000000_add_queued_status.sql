-- The application has used status = 'queued' since the job-queue system was
-- introduced, but the original CHECK constraint on sessions.status never included
-- it — only 'pending', 'processing', 'completed', 'failed' were allowed. Any write
-- of status='queued' violates the constraint. Widen it to match actual usage.
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_status_check;

ALTER TABLE sessions
  ADD CONSTRAINT sessions_status_check
  CHECK (status IN ('pending', 'queued', 'processing', 'completed', 'failed'));
