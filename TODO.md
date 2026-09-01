# Frontend TODO / technical debt backlog

Remaining items from the production-readiness audit (2026-09) that are **not yet done**.
P0 and most P1 items were already fixed — see `CLAUDE.md` and git history for what changed.
This list is what's left.

## Needs a product/infra decision first

- [ ] **Stripe billing.** `stripe` is a dependency, `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`
      are documented env vars, but no `app/api/billing/` or `app/api/stripe/` routes exist.
      The "Manage Billing" nav button was hidden rather than left silently broken. Needs
      real Stripe integration (checkout, customer portal, webhook handler with signature
      verification) or the dependency/docs should be removed if billing isn't happening
      soon.
- [ ] **Observability (Sentry or similar).** No error tracking on the frontend. Needs a
      DSN before wiring up `@sentry/nextjs`.
- [ ] **Signed URLs for Supabase Storage.** The `video-storage` bucket is public — anyone
      with a leaked clip URL can view/download it forever, no expiry. Low risk today
      (UUIDs are unguessable), but worth doing a signed-URL pass before this scales.
      Note: this touches every place a clip/video URL is read (`dashboard`,
      `session-group-card.tsx`, `clip-card.tsx`, `video-player.tsx`) and needs a
      refresh strategy for long-lived dashboard sessions — not a quick swap.
- [ ] **`GET /api/sessions` auto-repair workaround** (`app/api/sessions/route.ts`) — silently
      rewrites `status`/`clip_paths`/etc. on every list request when `clips_metadata` is
      populated but `clip_paths` isn't. This masks a historical write-path bug that was
      never confirmed fixed. Left alone deliberately — removing it risks breaking display
      of existing sessions without knowing if the root cause is actually gone. Worth an
      explicit investigation: is the write-path bug still live for *new* sessions?

## Code quality / maintainability (P2 — safe to defer indefinitely)

- [ ] **Auth-check and ownership-check boilerplate duplicated across ~11 API routes.**
      This exact duplication is *how* the queue-position IDOR (fixed) happened in the
      first place — a route can silently miss the ownership half. Extract to shared
      `requireUser(supabase)` / `requireOwnedSession(sessionId, user, supabase)` helpers
      in `lib/`.
- [ ] **Quota-check logic hand-rolled 3 times** (`process-video/stream`,
      `upload/generate-url`, `upload/youtube`) instead of using the existing
      `lib/quota.ts` (`getUserQuota`/`hasRemainingAttempts`) helpers, which none of them
      actually call.
- [ ] **Inconsistent error-response shapes** — `upgradeRequired`/`maxRetriesReached` flags
      added ad hoc per-route instead of a standard error envelope.
- [ ] **Client-side `MAX_RETRIES = 3` hardcoded** in `components/session-group-card.tsx`
      — can silently drift from the server's env-configurable `MAX_SESSION_RETRIES`
      (`app/api/sessions/[sessionId]/retry/route.ts`). Should read from an API response
      instead of duplicating the constant.

## Also worth knowing
- The repo's pre-existing `.env.example` is stale (references `OPENAI_API_KEY`, a
  leftover from an earlier version — the backend actually uses `ANTHROPIC_API_KEY`) and
  is missing most required vars. A sandbox permission issue prevented fixing it directly
  during the audit pass — **someone needs to update it by hand**. The accurate, current
  list of required env vars is in `CLAUDE.md`.
