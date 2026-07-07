# Changelog

## [Unreleased] — v2-development

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
