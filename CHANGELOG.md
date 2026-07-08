# Changelog

## [Unreleased] — v2-development

### 2026-07-08 — Student Dashboard completion (Priority 1) + P0 mock_results fix

**Fixed (P0)**
- Mock test results were **never saved in production**: `MockTestEngine.jsx`
  inserts `test_title, marks, percentage, accuracy, subject_stats`, but the
  columns didn't exist, so every insert failed silently (0 rows verified).
  Migration `20260708053000_dashboard_mock_results_columns_and_leaderboard`
  (applied to production, verified) adds the columns — the existing engine
  insert now works with no engine code change. Rollback SQL included.
- Removed the hardcoded fake "Quiz Streak: 3 days" stat from the dashboard.

**Added**
- Student Dashboard (`/dashboard`) completed: Progress stats (tests/avg/
  best/plan), Continue Study (re-launch last test + quick actions),
  Performance Trend chart (dependency-free inline SVG), Weak Subject
  Analysis (aggregated `subject_stats`), Mock Test History (20 rows with
  accuracy/time), Subscription Status card (`pro_expires_at`), Leaderboard,
  Bookmarks, Latest Current Affairs. Fully responsive; reuses existing
  `card`/`badge`/`btn-*` utilities, `Layout`, and toast.
- `get_leaderboard(limit_count)` RPC — SECURITY DEFINER cross-user
  aggregate (RLS on `mock_results` correctly blocks client-side
  leaderboards). Returns abbreviated names + averages only; execute
  granted to `authenticated` only (anon revoked, verified).
- Bookmark toggle on Current Affairs cards — first producer for the
  previously unused `bookmarks` table (own-rows RLS already in place).
- Index `idx_mock_results_user_created (user_id, created_at desc)`.
- `docs/STUDENT_DASHBOARD.md` — audit findings, data sources, security
  review, rollback caveat.

**Security**
- No RLS bypassed or modified; all reads are own-row except the
  locked-down leaderboard RPC. No service-role usage in frontend.

### 2026-07-07 — Automated daily scheduler (GitHub Actions) + DB concurrency guard

**Added**
- `.github/workflows/current-affairs-daily.yml`: runs the existing collector
  every morning (06:30 IST) and on demand (`workflow_dispatch` with `count`
  and `dry_run` inputs). Workflow-level concurrency group, 15-minute
  timeout, one automatic retry (safe — dedup is idempotent by source_hash),
  and failure notification via a deduplicated GitHub issue plus GitHub's
  built-in failure email. Requires three Actions secrets: `GROQ_API_KEY`,
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (see docs).
- Migration `20260707161420_begin_automation_run_concurrency_guard`
  (applied to production, md5-verified copy in `supabase/migrations/`):
  new `begin_automation_run()` RPC — advisory-lock serialization per
  source, stale-run sweep (unfinished > 30 min → closed as failed), NULL
  when a live run is in flight, run-row insert + source registration in one
  transaction. `service_role` execute only (revoked from public/anon/
  authenticated). Rollback SQL included.
- `docs/AUTOMATION_SCHEDULER.md`: scheduler comparison (GitHub Actions vs
  Vercel Cron vs Supabase Scheduled Functions vs external cron), decision
  rationale, requirement→mechanism map, setup, failure playbook, rollback.

**Changed**
- `scripts/generate_current_affairs_v2.py`: `start_run()` now acquires the
  run atomically via `begin_automation_run()` and `main()` exits cleanly
  (code 0, zero side effects) when another run holds the lock. Removed the
  now-dead `Supa.upsert()` helper (source registration moved into the RPC)
  and corrected the stale "no concurrent writers" comment. No other
  pipeline behavior changed.
- Removed the accidentally committed `scripts/__pycache__/*.pyc` and added
  `__pycache__/` to `.gitignore` (it would have gone stale with this edit).

**Fixed**
- Concurrency hole: overlapping executions (scheduled + manual) could race
  `check_duplicate_draft()` and produce duplicate drafts; now impossible at
  the database layer for every execution path.
- Deadlock-by-crash: a killed run left `finished_at NULL` forever; the
  stale sweep now closes such runs as failed.

**Security**
- Service-role key lives only in GitHub encrypted Actions secrets (its
  sanctioned server-side home). `begin_automation_run` is not callable by
  anon or authenticated (verified via `has_function_privilege` in
  production). Workflow permissions minimized (`contents: read`,
  `issues: write`).

### 2026-07-07 — Fix: bulk archive (constraint + audit-log correctness)

**Fixed**
- `bulk_archive_drafts()` was 100% broken: it logged `event='archived'`,
  which the `ai_draft_logs` event CHECK constraint did not allow, so every
  call raised and rolled back. Migration
  `20260707124206_fix_archive_event_constraint_and_bulk_archive_logging`
  (applied to production, md5-verified copy in `supabase/migrations/`)
  adds `'archived'` to the constraint.
- Latent second bug found during the fix audit and fixed in the same
  migration: the function logged an `archived` event for *every* id passed,
  including drafts skipped for ineligible status (false audit entries) and
  ids no longer present in `ai_drafts` (FK violation → full rollback). The
  function now logs via `UPDATE … RETURNING`, so audit rows exist only for
  drafts actually archived, and the return value is the true archived count.

**Security**
- No change to the identity/admin guards, function signature, or grants.
  Regression-tested in production (rolled-back transactions, authenticated
  JWT claims): spoofed identity and matching-identity non-admin both
  rejected; mixed eligible/ineligible/nonexistent batch behaves correctly.

**Database**
- New migration `20260707124206` (applied). Rollback:
  `supabase/rollbacks/rollback_20260707124206_fix_archive_event_constraint_and_bulk_archive_logging.sql`
  — note it intentionally restores the pre-fix (broken) function and deletes
  post-fix `archived` audit rows; warnings documented in the file.

**Docs**
- `docs/ADMIN_DRAFTS.md` known-issue section replaced with fix record and
  production test evidence.

### 2026-07-07 — Admin Draft Review + Automation Health page

**Added**
- `/admin/drafts` (`src/pages/admin/AdminDrafts.jsx`): review queue for the AI
  content pipeline — list, status/type filters with live counts, debounced
  title search, preview, edit (auto-versioned by existing trigger), version
  history display, validate / approve / reject / publish, bulk approve /
  reject / publish / archive, confirmation dialogs, loading and error states.
- Automation health strip on the same page via `get_automation_health()`.
- Sidebar link **AI Drafts** in `AdminLayout`; protected route in `App.jsx`.
- `docs/ADMIN_DRAFTS.md` feature documentation and manual test checklist.

**Changed**
- `Modal` accepts an optional `maxWidth` prop (default `max-w-lg`, unchanged
  for all existing callers) so the draft preview can render wider.

**Security**
- All lifecycle actions call the existing identity-checked `security definer`
  RPCs with the authenticated admin's own UUID. No service keys in frontend.
  UI only enables transitions the database guards will accept.

**Known issue (pre-existing, verified in production, NOT fixed here)**
- `bulk_archive_drafts()` logs `event='archived'`, which the `ai_draft_logs`
  event CHECK constraint does not allow → the call always fails and rolls
  back. One-line constraint fix documented in `docs/ADMIN_DRAFTS.md`,
  awaiting approval (no new migrations permitted in this task).

**Database**: no new tables, no new migrations, no RPC changes.
