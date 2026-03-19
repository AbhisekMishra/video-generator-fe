-- Add model_used column to sessions table
-- Records which LLM model was selected for clip identification

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS model_used TEXT;
