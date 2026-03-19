# Video Generator Setup Guide

## Prerequisites

- Node.js 18+ installed
- Python 3.9+ installed (for backend)
- Supabase account
- GitHub account (for GitHub Models API)
- FFmpeg installed (for video processing)

---

## 1. Supabase Setup

### Create Project & Database

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Create a new project
3. Wait for database provisioning

### Run Database Migration

1. Install Supabase CLI (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. Run the migration:
   ```bash
   # Option A: Using Supabase CLI
   supabase db push

   # Option B: Manual SQL execution
   # Go to Supabase Dashboard → SQL Editor
   # Copy and paste the content of:
   # video-generator-fe/supabase/migrations/20250101000000_create_sessions_table.sql
   # Click "Run"
   ```

### Create Storage Bucket

1. Go to **Storage** in Supabase Dashboard
2. Click **New Bucket**
3. Name: `video-storage`
4. **Public bucket**: ✅ Enabled
5. Click **Create**

### Get Credentials

1. Go to **Settings** → **API**
2. Copy:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key**

3. Go to **Settings** → **Database**
4. Scroll to **Connection string**
5. Select **Transaction pooler** mode
6. Copy the connection string (e.g., `postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`)

---

## 2. GitHub Models Setup

1. Go to [GitHub Settings → Tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Name: `Video Generator Models`
4. **No scopes needed** (GitHub Models uses PAT for identification only)
5. Click **Generate token**
6. Copy the token (starts with `ghp_`)

---

## 3. Environment Variables

### Frontend (.env or .env.local)

Create `.env` file in `video-generator-fe/`:

```bash
# GitHub Token for AI Models
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx

# FastAPI Backend URL
FASTAPI_URL=http://localhost:8000

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGxxxxxxxxxxxxxxx

# Database URL for LangGraph checkpointing
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

---

## 4. Install Dependencies

### Frontend

```bash
cd video-generator-fe
npm install
```

### Backend

```bash
cd video-generator-be
pip install -r requirements.txt
```

---

## 5. Start Services

### Terminal 1: Start Backend

```bash
cd video-generator-be
python main.py
```

Backend runs on: `http://localhost:8000`

### Terminal 2: Start Frontend

```bash
cd video-generator-fe
npm run dev
```

Frontend runs on: `http://localhost:3000`

---

## 6. Test the Application

1. Open `http://localhost:3000`
2. Upload a video file
3. Click **Upload** button
4. Wait for upload to complete
5. Click **Generate Clips** button
6. Watch progress through stages:
   - Transcribe → Identify Clips → Render
7. View generated clips

---

## Architecture Overview

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────┐
│  Next.js Frontend (Port 3000)   │
│  - Upload to Supabase           │
│  - Session management           │
│  - LangGraph workflow           │
└────────┬───────────────┬────────┘
         │               │
         ▼               ▼
┌──────────────┐  ┌────────────────┐
│   Supabase   │  │ Python Backend │
│              │  │  (Port 8000)   │
│ - PostgreSQL │  │                │
│ - Storage    │  │ - Transcribe   │
│ - Auth       │  │ - Render       │
└──────────────┘  └────────────────┘
         │
         ▼
┌──────────────────────────┐
│  LangGraph Checkpoints   │
│  (PostgreSQL tables)     │
└──────────────────────────┘
```

---

## Database Schema

### Sessions Table

Tracks each video processing session:

```sql
sessions (
  id              UUID PRIMARY KEY
  user_id         UUID              -- Future: auth.users reference
  thread_id       TEXT UNIQUE       -- LangGraph checkpoint ID

  -- Video info
  original_video_url   TEXT
  original_video_path  TEXT
  original_filename    TEXT

  -- Processing status
  status          TEXT              -- pending, processing, completed, failed
  current_stage   TEXT              -- transcribe, identifyClips, render
  progress        INTEGER           -- 0-100

  -- Results
  clip_paths      TEXT[]            -- Array of clip storage paths
  total_clips     INTEGER
  completed_clips INTEGER

  -- Timestamps
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
  completed_at    TIMESTAMPTZ
)
```

### LangGraph Checkpoints (Auto-created)

LangGraph automatically creates these tables to store workflow state:

```sql
checkpoints (
  thread_id       TEXT
  checkpoint_id   TEXT
  checkpoint      JSONB             -- Full workflow state
  -- ...
)
```

---

## API Endpoints

### Frontend APIs

- `POST /api/upload/generate-url` - Generate signed upload URL
- `POST /api/upload/confirm` - Confirm upload completion
- `POST /api/process-video/stream` - Start video processing (SSE)
- `GET /api/sessions` - List all sessions
- `GET /api/sessions/[sessionId]` - Get session details
- `DELETE /api/sessions/[sessionId]` - Delete session

### Backend APIs

- `GET /` - Health check
- `POST /transcribe` - Transcribe video with Whisper
- `POST /render` - Render video clips

---

## Troubleshooting

### Issue: "Failed to create signed upload URL: row violates RLS"

**Solution**: Disable RLS on storage bucket or create proper policies:
1. Go to Supabase Dashboard → Storage → video-storage
2. Click **Policies** tab
3. Disable RLS or run the policies from the migration file

### Issue: "Database connection failed"

**Solution**: Check DATABASE_URL format:
- Must use **Transaction pooler** mode (port 6543, not 5432)
- Must include password in the connection string
- Format: `postgresql://postgres.[project]:[password]@[host]:6543/postgres`

### Issue: "FFmpeg not found"

**Solution**: Install FFmpeg:
```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg

# Windows
# Download from https://ffmpeg.org/download.html
```

### Issue: "GitHub Models rate limit"

**Solution**: GitHub Models has free tier limits. If exceeded:
- Wait for rate limit reset
- Or switch to OpenAI API (change configuration in `lib/graph.ts`)

---

## Next Steps

1. **Add Authentication**: Replace hardcoded user ID with actual auth
2. **Add user quota limits**: Limit clips per user/month
3. **Optimize video storage**: Add compression, lifecycle policies
4. **Add analytics**: Track usage, popular clips
5. **Mobile responsive**: Improve mobile UX

---

## Support

For issues or questions:
- Check this setup guide
- Review error logs in browser console and terminal
- Check Supabase dashboard for database/storage issues
