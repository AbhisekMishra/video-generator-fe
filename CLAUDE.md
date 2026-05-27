# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server on http://localhost:3000
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint via Next.js
```

There is no test framework configured. `scripts/test-db-connection.js` is a standalone Supabase connectivity check, not a test suite.

## Architecture

This is a **Next.js 14 (App Router) SaaS frontend** for an AI video-to-clips tool. Users upload a long video (or provide a YouTube URL), it gets processed by a FastAPI backend running a LangGraph AI workflow, and the result is a set of short 9:16 clips with captions.

**Backend dependency**: The FastAPI backend must be running at `FASTAPI_URL` (default `http://localhost:8000`). The frontend only calls two backend endpoints:
- `POST /process-video` — enqueue video for processing
- `POST /validate-youtube` — check duration before creating a session

**Infrastructure stack**: Supabase (auth + PostgreSQL + Storage), Stripe (billing), FastAPI backend.

## Key Data Flow

### Session Lifecycle
Sessions track video processing end-to-end and flow through these statuses:
`pending` → `queued` → `processing` → `completed` / `failed`

Sessions also track `current_stage` (transcribe / identify_clips / detect_focus / render) and `progress` (0–100).

### Upload Flow (file upload)
1. Client validates file type & duration (>20s) in browser
2. `POST /api/upload/generate-url` — checks quota, returns signed Supabase Storage URL
3. Client XHRs directly to Supabase Storage with progress tracking
4. `POST /api/upload/confirm` — creates session record in DB
5. `POST /api/process-video/stream` — checks quota atomically (RPC), enqueues to FastAPI, returns queue position

### Upload Flow (YouTube)
1. Client validates URL pattern
2. `POST /api/upload/youtube` — optionally calls `/validate-youtube` on backend, creates session with video URL

### Dashboard Polling
Dashboard polls `/api/sessions` every 5 seconds while any session has `status: queued | processing`. Queue position is fetched from `/api/queue-position/[sessionId]`.

## Supabase Setup

Three Supabase clients exist for different contexts:
- `lib/supabase.ts` — browser client (uses `NEXT_PUBLIC_*` keys)
- `lib/supabase-server.ts` — server-side client for API routes (uses service role key)
- `lib/supabase-admin.ts` — admin client that bypasses RLS (for webhook handlers)

**Key tables:**
- `sessions` — core table; stores session status, clip paths, metadata, error info
- `user_quotas` — `attempts_used` / `attempts_limit` / `plan_tier` per user
- `checkpoints` — LangGraph state persistence (auto-managed by backend)

**Storage bucket:** `video-storage` (public). Path structure: `sessions/{sessionId}/{original|clips|captions}`.

## Quota System

Quota is enforced at two points: upload URL generation and processing enqueue. The processing enqueue uses a PostgreSQL RPC to atomically increment `attempts_used`, preventing race conditions. Returns HTTP 402 when quota is exhausted.

## Environment Variables

```
FASTAPI_URL                      # Backend URL (default: http://localhost:8000)
NEXT_PUBLIC_SUPABASE_URL         # Supabase project URL (exposed to browser)
NEXT_PUBLIC_SUPABASE_ANON_KEY    # Supabase anon key (exposed to browser)
SUPABASE_SERVICE_ROLE_KEY        # Secret — server-side API routes only
DATABASE_URL                     # PostgreSQL connection (LangGraph checkpointing)
STRIPE_SECRET_KEY                # Stripe billing
STRIPE_WEBHOOK_SECRET            # Stripe webhook verification
```

Copy `.env.example` to `.env.local` for local development.

## Authentication

Authentication uses Supabase Auth (email/password). `middleware.ts` runs `supabase.auth.getUser()` on every request to refresh the session cookie. `contexts/auth-context.tsx` exposes `user`, `session`, `loading`, `signIn`, `signUp`, `signOut` to client components.

All API routes that act on user data call `supabase.auth.getUser()` and return 401 if the user is not authenticated.

## API Route Organization

```
app/api/
  upload/
    generate-url/    POST  Create signed Supabase Storage upload URL (quota check)
    confirm/         POST  Confirm upload, create session record
    youtube/         POST  Create session for YouTube URL
  process-video/
    stream/          POST  Enqueue job to FastAPI backend (quota atomic increment)
    route.ts               DEPRECATED — returns 410 Gone
  sessions/
    route.ts         GET   List user sessions (includes auto-repair for orphaned clips_metadata)
    [sessionId]/     GET   Session detail | DELETE Session
    [sessionId]/retry/         POST  Retry failed session
    [sessionId]/regenerate/    POST  Regenerate clips
  queue-position/[sessionId]/  GET  Queue position from backend
  quota/             GET   User quota info
  billing/                 Stripe billing portal
  stripe/                  Stripe webhook handlers
  auth/callback/           OAuth redirect
  invite/            POST  Invite users
```

## Component Patterns

Components use **shadcn/ui** (Radix UI primitives + Tailwind) from `components/ui/`. The `cn()` utility in `lib/utils.ts` merges Tailwind classes (uses `clsx` + `tailwind-merge`).

Clips are displayed at **9:16 aspect ratio** (`aspect-[9/16]`). Session status is rendered via `components/status-badge.tsx`.

State management is minimal: React Context for auth, Supabase PostgreSQL for server state, local `useState` for UI state. No Redux/Zustand.

## Auto-Repair Logic

`GET /api/sessions` includes a workaround: if a session has `clips_metadata` populated but `clip_paths` is empty/null, it reconstructs `clip_paths` from the metadata. This addresses a historical bug where clip paths weren't written back to the session.
