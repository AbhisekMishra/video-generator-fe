# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server on http://localhost:3000
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint via Next.js
npm test         # Run the Vitest suite (lib/__tests__/)
```

Vitest covers pure logic in `lib/` only (`cn()`, quota helpers, `lib/backend.ts`'s env-var handling) — no component/route tests yet. CI (`.github/workflows/ci.yml`) runs typecheck, tests, and build on every push/PR. `test-db-connection.js` (repo root) is a standalone Supabase connectivity check, not part of the test suite.

## Architecture

This is a **Next.js 14 (App Router) SaaS frontend** for an AI video-to-clips tool. Users upload a long video (or provide a YouTube URL), it gets processed by a FastAPI backend running a sequential pipeline (transcribe → identify clips via Claude → generate captions → render), and the result is a set of short 9:16 clips with captions.

**Backend dependency**: The FastAPI backend must be running at `FASTAPI_URL` (default `http://localhost:8000`). Every call to it requires the `X-Internal-Api-Key` header (`FASTAPI_INTERNAL_API_KEY` env var) — the backend rejects requests without it. The frontend calls:
- `POST /process-video` — enqueue video for processing
- `POST /validate-youtube` — check duration before creating a session
- `GET /process-video/queue-position/{session_id}` — poll queue position

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
- `sessions` — core table; stores session status, clip paths, metadata, error info. Also has a `pipeline_state` JSONB column (2026-09) the backend uses to cache each pipeline stage's output (transcript/clips/captions/rendered clips) for crash-resume — see the backend's `CLAUDE.md`.
- `user_quotas` — `attempts_used` / `attempts_limit` / `plan_tier` per user
- `checkpoints` — leftover from an earlier LangGraph-based backend; the backend never used a Postgres checkpointer in practice (it ran an in-memory-only checkpointer, since replaced by the plain pipeline above) — this table is very likely unused. Verify before relying on it or dropping it.

**Storage bucket:** `video-storage` (public). Path structure: `sessions/{sessionId}/{original|clips|captions}`.

## Quota System

Quota is enforced at two points: upload URL generation and processing enqueue. The processing enqueue uses a PostgreSQL RPC to atomically increment `attempts_used`, preventing race conditions. Returns HTTP 402 when quota is exhausted.

**Plan tiers** (2026-09, Lemon Squeezy): `free` (3 lifetime attempts, default on signup), `starter` ($9/mo, 20 attempts, resets monthly), `pro` ($29/mo, 60 attempts, resets monthly) — `lib/lemonsqueezy.ts`'s `PLANS` map is the source of truth for tier→quota; `attempts_limit` per tier lives there, not in the DB. `user_quotas` gained `lemonsqueezy_customer_id`, `lemonsqueezy_subscription_id`, `subscription_status`, `current_period_end` (migration `20260902000000_add_lemonsqueezy_billing.sql`).

**Billing flow**: `/pricing` (new page) → `POST /api/checkout` (creates a Lemon Squeezy checkout via their REST API, embeds the Supabase `user_id` as checkout `custom_data` so the webhook can map back to a user) → user pays on Lemon Squeezy's hosted checkout → `POST /api/webhooks/lemonsqueezy` (signature-verified via `X-Signature` HMAC-SHA256, see `lib/lemonsqueezy.ts`'s `verifyWebhookSignature`) updates `user_quotas` on `subscription_created`/`updated`/`cancelled`/`expired`, and resets `attempts_used` to 0 on `subscription_payment_success` (the monthly renewal reset). `GET /api/billing-portal` looks up the user's `lemonsqueezy_subscription_id` and redirects to Lemon Squeezy's hosted customer portal (manage/cancel/update payment method) — wired to the navbar's "Manage Billing" button.

Stripe (`stripe` npm package, `STRIPE_*` env vars) is unused dead weight from an abandoned earlier attempt — no Stripe code exists anywhere. Not removed yet; safe to delete in a follow-up cleanup.

## Environment Variables

```
FASTAPI_URL                      # Backend URL (default: http://localhost:8000)
FASTAPI_INTERNAL_API_KEY         # Shared secret sent as X-Internal-Api-Key on every backend call — must match INTERNAL_API_KEY on the backend
NEXT_PUBLIC_SUPABASE_URL         # Supabase project URL (exposed to browser)
NEXT_PUBLIC_SUPABASE_ANON_KEY    # Supabase anon key (exposed to browser)
SUPABASE_SERVICE_ROLE_KEY        # Secret — server-side API routes only
DATABASE_URL                     # PostgreSQL connection — not used by any app code path (only test-db-connection.js); likely leftover from an earlier LangGraph checkpointing plan
ADMIN_EMAILS                     # Comma-separated email allowlist permitted to use POST /api/invite
LEMONSQUEEZY_API_KEY             # Bearer token for the Lemon Squeezy REST API (checkouts, subscription lookups)
LEMONSQUEEZY_STORE_ID            # Your Lemon Squeezy store ID
LEMONSQUEEZY_WEBHOOK_SECRET      # Signing secret configured on the webhook in the LS dashboard — verifies X-Signature
LEMONSQUEEZY_STARTER_VARIANT_ID  # Variant ID for the $9/mo Starter subscription product
LEMONSQUEEZY_PRO_VARIANT_ID      # Variant ID for the $29/mo Pro subscription product
STRIPE_SECRET_KEY                # Dead — abandoned Stripe attempt, no code uses this
STRIPE_WEBHOOK_SECRET            # Dead — abandoned Stripe attempt, no code uses this
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
  auth/callback/           OAuth redirect
  invite/            POST  Invite users (requires ADMIN_EMAILS allowlist)
  checkout/          POST  Create a Lemon Squeezy checkout for a plan
  billing-portal/    GET   Redirect URL to Lemon Squeezy's hosted customer portal
  webhooks/
    lemonsqueezy/    POST  Lemon Squeezy subscription events (signature-verified)
```

Billing is implemented via Lemon Squeezy (2026-09) — see the Quota System section above for the full flow (`/pricing`, `/api/checkout`, `/api/webhooks/lemonsqueezy`, `/api/billing-portal`). The navbar's "Manage Billing" button is wired up. `STRIPE_*` env vars and the `stripe` npm dependency are dead leftovers from an abandoned earlier attempt.

## Component Patterns

Components use **shadcn/ui** (Radix UI primitives + Tailwind) from `components/ui/`. The `cn()` utility in `lib/utils.ts` merges Tailwind classes (uses `clsx` + `tailwind-merge`).

Clips are displayed at **9:16 aspect ratio** (`aspect-[9/16]`). Session status is rendered via `components/status-badge.tsx`.

State management is minimal: React Context for auth, Supabase PostgreSQL for server state, local `useState` for UI state. No Redux/Zustand.

## Auto-Repair Logic

`GET /api/sessions` includes a workaround: if a session has `clips_metadata` populated but `clip_paths` is empty/null, it reconstructs `clip_paths` from the metadata. This addresses a historical bug where clip paths weren't written back to the session.
