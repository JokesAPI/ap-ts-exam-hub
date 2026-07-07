# Changelog

## [Unreleased] — v2-development

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
