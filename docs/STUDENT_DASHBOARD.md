# Student Dashboard (Priority 1 — Completion)

**Date:** 2026-07-08 · **Branch:** v2-development
**Route:** `/dashboard` (protected by `AuthRoute`)

## What was found (audit)

The pre-existing dashboard showed only: name/plan header, upgrade banner,
4 stat tiles (one of which — "Quiz Streak: 3 days" — was hardcoded fake
data), a quick-actions grid, and the last 5 test results.

**P0 discovered during the audit:** `MockTestEngine.jsx` inserts
`test_title, marks, percentage, accuracy, subject_stats` into
`mock_results`, but those columns never existed in production. Every
result insert failed silently (error only in browser console). Verified:
production `mock_results` had **0 rows**. The entire dashboard priority
was blocked by this, so the fix is part of this feature.

## Database changes

Migration: `supabase/migrations/20260708053000_dashboard_mock_results_columns_and_leaderboard.sql`
(applied to production 2026-07-08, verified)
Rollback: `supabase/rollbacks/rollback_20260708053000_dashboard_mock_results_columns_and_leaderboard.sql`

1. **`mock_results` columns added:** `test_title text`, `marks numeric(8,2)`,
   `percentage integer`, `accuracy integer`, `subject_stats jsonb`.
   Additive and backward compatible; the existing engine insert now works
   with **zero frontend engine changes**.
2. **Index:** `idx_mock_results_user_created (user_id, created_at desc)` —
   matches the dashboard's history query.
3. **RPC `get_leaderboard(limit_count int default 10)`** — `SECURITY
   DEFINER`, `stable`, `set search_path = public`.
   - Why an RPC: `mock_results` RLS (`mock_results_own`) correctly blocks
     reading other users' rows, so a leaderboard cannot be built client-side.
   - Privacy: returns only abbreviated display names ("Ravi K."), tests
     taken, average % and best %. No user ids, emails, or raw rows.
   - Access: `EXECUTE` granted to `authenticated` and `service_role`
     only; revoked from `public` and `anon` (verified with
     `has_function_privilege`). Internal `auth.uid() is not null` guard as
     defense in depth.
   - Caps `limit_count` between 1 and 50.

## Dashboard sections (all responsive)

| Section | Data source |
|---|---|
| Progress stats (tests, avg, best, plan) | `mock_results` own rows; hardcoded "Quiz Streak" removed |
| Continue Study | last `mock_results` row → "Practice Again" re-launches same test via existing `/mock-test/start` route state; quick-actions grid retained |
| Performance Trend chart | last 10 results, dependency-free inline SVG (no chart library added) |
| Weak Subject Analysis | aggregated `subject_stats` across saved results, weakest first, Genius AI nudge |
| Mock Test History | last 20 results with title, score, accuracy, time, date |
| Subscription Status | `profiles.is_pro` / `pro_expires_at` via existing `useAuth().isPro` |
| Leaderboard | `supabase.rpc('get_leaderboard')`, own row highlighted |
| Bookmarks | `bookmarks` own rows (RLS `bookmarks_own`), hydrated with article titles; remove button |
| Latest Current Affairs | newest 5 `current_affairs` (public read policy) |

## Bookmarks producer

The `bookmarks` table existed with a correct own-rows RLS policy but was
completely unused — nothing in the app could create a bookmark. A bookmark
toggle was added to each Current Affairs card
(`src/pages/public/CurrentAffairs.jsx`): signed-in users can save/remove
articles (`item_type = 'current_affairs'`, `item_id = article uuid`);
signed-out users get a "Login to bookmark" toast. RLS enforces ownership —
no policy changes were needed.

## Security review

- No new tables; no RLS policies changed or bypassed.
- All dashboard reads are own-row queries under existing RLS, except the
  leaderboard, which goes through the locked-down RPC above.
- No service-role key anywhere in frontend code.
- `supabase-schema-v2.sql` remains a **stale historical file** (it says RLS
  is disabled; production has RLS enabled with policies on every table
  checked). Not modified in this commit — flagged for a future docs cleanup.

## Rollback caveat

Dropping the five columns loses their data and re-breaks result saving
(the engine insert references them). Roll back only together with a
frontend revert.
