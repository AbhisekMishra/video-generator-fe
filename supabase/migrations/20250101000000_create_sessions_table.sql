-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Original video
  original_video_url TEXT NOT NULL,
  original_video_path TEXT NOT NULL,
  original_filename TEXT,
  original_file_size BIGINT,
  original_duration FLOAT,

  -- Processing status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  current_stage TEXT,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),

  -- LangGraph checkpoint reference
  thread_id TEXT UNIQUE NOT NULL,

  -- Storage paths (array of generated clip paths)
  clip_paths TEXT[] DEFAULT '{}',
  caption_paths TEXT[] DEFAULT '{}',

  -- Quick access metadata (denormalized from checkpoint)
  total_clips INTEGER DEFAULT 0,
  completed_clips INTEGER DEFAULT 0,

  -- Error tracking
  error_message TEXT,
  error_stage TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_thread_id ON sessions(thread_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);

-- Enable Row Level Security
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own sessions"
  ON sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create sessions"
  ON sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Storage policies for session-based file access
CREATE POLICY "Users can view own session files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'video-storage' AND
    (storage.foldername(name))[1] = 'sessions' AND
    (storage.foldername(name))[2]::uuid IN (
      SELECT id FROM sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can upload to own sessions"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'video-storage' AND
    (storage.foldername(name))[1] = 'sessions' AND
    (storage.foldername(name))[2]::uuid IN (
      SELECT id FROM sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own session files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'video-storage' AND
    (storage.foldername(name))[1] = 'sessions' AND
    (storage.foldername(name))[2]::uuid IN (
      SELECT id FROM sessions WHERE user_id = auth.uid()
    )
  );
