-- Add clips_metadata column to sessions table
-- This stores the start/end timestamps and metadata for each generated clip,
-- enabling the regeneration workflow to exclude already-generated clip ranges.

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS clips_metadata JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN sessions.clips_metadata IS
  'Array of clip metadata objects: [{start, end, title, score}]. Used to prevent duplicate clips on regeneration.';
