# Changelog

## [Unreleased] — v2-development

### 2026-07-09 — Phase 5: Previous Papers (PYQ) system completion

**Added**
- Bookmark papers: paper cards wired to the existing `bookmarks` table
  (`item_type='previous_papers'`, own-row RLS); shown on the student
  dashboard Bookmarks section with type-aware links.
- Recently viewed papers: new `src/lib/recentPapers.js` (localStorage, capped
  at 8), surfaced on the papers page.
- Subject filter dropdown on the papers page (subject was displayed but not
  filterable).
- CSV bulk import in AdminPapers (dependency-free parser; admin-only via
  existing RLS; title-less rows rejected).

**Changed**
- Org labels updated to official TG naming (TSPSC→TGPSC, TS Police→TG Police)
  on the papers pages. Website name unchanged (**AP TS Exam Hub**).

**Deferred:** AI tagging of papers (needs distinct AI workflow; no data
fabricated).

**Database:** none (reuses `bookmarks` + `previous_papers`; no migration).
**Security:** bookmark writes own-row; CSV import admin-only; no new DB
objects, no service-role, no secrets. **Performance:** no new deps.

### 2026-07-09 — Admin metrics & Automation dashboard

**Database**
- `20260709160000_phase5_question_metrics_rpc`: new admin-gated
  `get_question_metrics()` RPC (real question/AI counts + by-exam/subject/
  difficulty + recent AI activity; SECURITY DEFINER, search_path pinned).
  Hardening: revoke EXECUTE from PUBLIC on `get_question_metrics` and
  `get_automation_health`, re-grant to authenticated/service_role only (anon
  denied). Rollback included. No table/RLS changes.

**Added**
- Admin dashboard Question Bank metrics section (real counts + by-subject/
  by-exam) — additive; existing cards unchanged.
- `/admin/automation` dashboard (lazy-loaded, ~6.85 kB chunk): health cards,
  last run/success/failure, sources table, recent AI activity — all from
  existing/new RPCs, no fabricated data. Nav link added.

**Performance:** no new deps; automation page code-split; dashboard uses one
RPC instead of many client queries.
**Security:** metrics RPCs admin-gated; anon EXECUTE removed; route behind
AdminRoute; no secrets in frontend.

### 2026-07-09 — Phase 4: AI Question Pipeline (non-duplicative)

**Database**
- `20260709140000_phase4_publish_validate_questions`: extends `validate_draft`
  and `publish_draft` with a `questions` branch (create-or-replace; four
  existing content types preserved; both remain SECURITY DEFINER + admin-gated
  + auth.uid() checked). Questions drafts can now be validated (options,
  answer A–D, required explanation, difficulty, duplicate check) and published
  into `mock_questions` (published/ai_generated/human_verified, exam_id from
  exam_slug). Rollback restores the pre-Phase-4 functions.

**Added**
- `src/lib/aiQuestionGen.js`: AI question generation + explanation enrichment
  reusing the existing server-side Groq backend; inserts results into
  `ai_drafts` as `status='draft'` (never auto-published), with client-side
  validation and in-batch dedupe.
- AdminQuestions: "AI Generate" modal (10/25/50/100 by exam/subject/topic) and
  CSV import (dependency-free parser → existing draft import path). Excel via
  CSV export — no heavy dependency added (bundle unchanged).

**Reused (not duplicated):** AdminDrafts review queue, bulk actions, search,
filters, health dashboard, `check_duplicate_draft`, the scheduler, and the CA
generator.

**Security:** no RLS changes; admin gates + auth.uid() preserved; Groq key
server-side only; generated/imported content always enters as drafts.

### 2026-07-09 — Phase 3: Question Bank & AI Content Foundation

**Database (reconciled from production; migrations byte-identical + rollbacks added)**
- `20260709022206_phase3_question_bank_foundation`: extends the existing
  (previously unused) `mock_questions` table into a professional question
  bank — exam_id FK, topic, subtopic, language, source, source_year, tags,
  status, created_by, reviewed_by, ai_generated, human_verified,
  published_at, updated_at (+trigger), metadata; status/difficulty CHECK
  constraints (difficulty explicit easy/medium/hard — never inferred);
  indexes; RLS select-published policy; extends `ai_drafts.content_type` to
  accept `questions` (reuses the existing AI pipeline). Non-destructive
  backfill of all 75 rows → published/en/human_verified; 20 linked to exam.
- `20260709022725_phase3_question_bank_grants_hardening`: grant authenticated
  SELECT (published only), revoke all anon grants.

**Added (frontend)**
- Admin Question Bank (`/admin/questions`): CRUD, search + exam/subject/
  difficulty/status filters, bulk import (JSON → drafts, never auto-
  published), bulk approve/publish/reject, topic hierarchy fields,
  difficulty as explicit select, AI-generated badge. Reuses
  AdminLayout/Modal/toast.
- DB-backed question loading: `loadQuestionsForTest()` reads published
  `mock_questions` with the built-in `QUESTION_BANK` as fallback so existing
  tests keep working during migration (backward compatible; engine unchanged
  in behavior).

**Branding**
- Display title "TSPSC Group-1…" → "TGPSC Group-1…" per permanent TG naming
  rule (internal `tspsc-gs-1` keys unchanged to preserve data joins).

**Deferred:** difficulty is now stored explicitly; a legacy seed quiz row
still references "TSPSC" as historical factual content (left intact).

**Security:** admin-gated writes (`mock_questions_write_admin`),
published-only reads, anon revoked — verified in production. No
service-role. Route behind `AdminRoute`.

### 2026-07-08 — Phase 2: Mock Test System Completion

**Added**
- Previous Attempts page (`/mock-tests/attempts`, protected): overall
  best/avg/count, per-test summary cards with mini trend + Retry, test
  filter, full attempt list with per-test improvement deltas. Reads
  existing `mock_results` under own-row RLS; skeleton + empty states;
  responsive.
- Dashboard "Recommended Next Test" card (weakest-subject → targeted test)
  and a "View all attempts" link. Discoverable "My Attempts" link on the
  Mock Tests page.
- `src/lib/mockStats.js` — shared stat/recommendation helpers, replacing
  logic that was copy-pasted across the engine and dashboard.

**Deferred (documented, not implemented)**
- Difficulty analysis → Phase 3 (Question Bank): questions have no
  `difficulty` field. No difficulty fabricated or inferred; no schema added.
- Per-question time analysis: engine records total time only; no fake
  per-question data shown.

**Database:** none (no migration; reuses existing columns and RPCs).
**Security:** new route behind `AuthRoute`; `mock_results_own` RLS verified;
no new DB objects, no service-role, premium gating untouched.

### 2026-07-08 — Phase 1: Exam-Centric Foundation (consolidated)

**Added**
- Canonical exam catalog: 29 exams (APPSC/TSPSC groups incl. "Services"
  titles, AP/TG EAPCET·POLYCET·ECET, AP/TG TET·DSC, AP/TG Police SI &
  Constable, SSC CGL/CHSL/MTS, RRB NTPC/Group D, IBPS PO/Clerk, SBI
  PO/Clerk) with permanent SEO slugs, category, state, display_order,
  is_active. Slugs frozen by a DB trigger (`trg_exams_protect_slug`) —
  immutable for app roles forever.
- Primary exam selection: `profiles.selected_exam_id` (FK) + `ExamContext`
  (profile-wins resolution, guest localStorage, one-time guest→profile
  sync) + reusable `ExamPicker` modal. Surfaces: Navbar chip (desktop +
  mobile), dashboard "Preparing for" chip + one-time prompt, Mock Tests
  "For my exam" filter, Previous Papers exam filter, `/exams` "Set as my
  exam". `previous_papers.exam_id` FK added (papers exam-linkable).
- Repo↔production reconciliation: two production-applied migrations were
  missing from the repo and are now committed byte-identical (md5-verified):
  `20260708013156_mock_test_rank_prediction`,
  `20260708061409_phase1_exam_centric_foundation` (work of a parallel
  session — see docs/PHASE1_EXAM_FOUNDATION.md provenance note).

**Fixed**
- Canonical APPSC Group-2 is the oldest content-rich record (`fa4bfb17`);
  both approved duplicates removed; references repointed. Zero duplicate
  slugs/titles in the catalog.
- Missing `GRANT UPDATE (selected_exam_id)` — exam selection could not be
  saved by signed-in users; verified working via simulated authenticated
  session.
- `/previous-papers` P0: page always queried non-existent columns
  (`order by year` → 400). Additive columns added; `organization`
  backfilled from `exam_category`.
- TG display naming (TG DSC, TG Police SI, TG Police Constable) with final
  `tg-*` slugs, renamed pre-freeze.

**Security**
- No RLS policies modified. Premium/admin profile columns verified still
  locked (authenticated `is_pro` update → permission denied). Slug
  immutability enforced at DB level. Auth, subscription, admin panel,
  dashboard, automation untouched and verified via page-query checks.
- Corrective migration `20260708090000_phase1_catalog_corrections` applied
  to production; rollback dry-run executed and verified restorative.

### 2026-07-08 — Mock Test Improvements (Priority 2)

**Added**
- Resume interrupted tests: in-progress exam sessions (answers, question
  order, time left) persist via new shared `src/lib/testSession.js`
  (localStorage, 24h expiry, cleared on submit) with a Resume/Start Fresh
  screen in the engine. Resume entry points on `/mock-tests` (banner with
  Discard) and the dashboard's Continue Study section.
- Result screen: rank prediction card via the **existing** `get_test_rank`
  RPC (reused, not duplicated); Previous Attempts card with delta vs last
  attempt; subject-wise "+N% vs your avg" historical badges; personalized
  next-test recommendation driven by weakest subject (new
  `SUBJECT_TO_TEST`/`TEST_TITLES` maps in `src/lib/questions.js`);
  "Review Wrong (N)" quick action.
- Answer review filters (All/Wrong/Skipped/Correct) with counts, preserved
  question numbering, and empty states.
- Skeleton loading for the engine and result side-cards; icon-only nav
  buttons + scrollable question palette on mobile.
- Migration `20260708113000_codify_get_test_rank_rpc`: codifies the
  production `get_test_rank` definition into the repo (it existed in
  production but was missing from migrations — source-of-truth gap).
  Safe no-op re-apply, executed against production; rollback included.
  No new DB objects, columns, or policy changes.

**Fixed**
- Same-route test switching (recommendation button) now resets state and
  loads the correct question bank via a `testId`-change effect instead of
  a stale closure.

**Security**
- No RLS/RPC modifications. Previous-attempt reads use `mock_results_own`.
  `get_test_rank` verified: SECURITY DEFINER, pinned search_path, anon
  execute revoked, aggregate-only output. Free-test paywall accounting
  unchanged (resume never double-counts).

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
