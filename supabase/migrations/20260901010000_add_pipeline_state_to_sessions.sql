-- Add pipeline_state column to sessions table
--
-- Stores each pipeline stage's output (transcript, identified clips, generated
-- captions, rendered clip URLs) as it completes, keyed by stage name. This lets
-- a retried/resumed job skip stages it already finished instead of redoing
-- expensive work (Whisper transcription, an LLM call, FFmpeg renders) from
-- scratch after a crash or transient failure.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS pipeline_state JSONB;
