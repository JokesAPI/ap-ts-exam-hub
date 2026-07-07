# Admin Draft Review + Automation Health — `/admin/drafts`

**Added:** 2026-07-07 · **Branch:** v2-development

The missing "head" of the AI content pipeline. The collector
(`scripts/generate_current_affairs_v2.py`) creates rows in `ai_drafts`; this
page is where an admin reviews, edits, approves, rejects, publishes, and
archives them — plus a live automation health summary.

## Access

Route `/admin/drafts`, guarded by the existing `AdminRoute` (requires
`profiles.is_admin = true`). Linked in the admin sidebar as **AI Drafts**.

## What it does

**Automation health strip** — calls `get_automation_health()` (admin-only RPC):
pending drafts, published today, total processed, duplicates caught, unresolved
dead-letter count (highlighted red when > 0), last run / last failure details,
manual refresh.

**Draft list** — latest 200 drafts from `ai_drafts` via the RLS-protected anon
client. Status filter tabs (with live counts), content-type dropdown, debounced
title search (`ilike`), checkbox multi-select. Validation failures for
`status='draft'` rows are surfaced inline from `review_notes`.

**Preview modal** — full content, structured `json_data`, source link, AI
model, confidence, review notes, and **version history** read from
`ai_draft_versions` (populated automatically by the existing
`trg_save_draft_version` trigger; the UI never writes versions itself).

**Edit** — title / content / json_data (JSON validated client-side before
save). A plain RLS-protected `update` on `ai_drafts`; the trigger snapshots the
previous version automatically.

**Lifecycle actions** — every action goes through the existing
identity-checked, `security definer` RPCs with the **authenticated admin's own
UUID** (`user.id` from `AuthContext`). No service keys anywhere in the
frontend. The UI only offers transitions the database will accept:

| Action | RPC | Enabled when status is |
|---|---|---|
| Validate | `validate_draft(p_draft_id)` | `draft` |
| Approve | `approve_draft(p_draft_id, p_admin_id)` | `validated` |
| Reject | `reject_draft(p_draft_id, p_admin_id, p_reason)` | any non-terminal |
| Publish | `publish_draft(p_draft_id, p_admin_id)` | `validated` or `approved` |
| Bulk approve | `bulk_approve_drafts` | ≥1 selected `validated` |
| Bulk reject | `bulk_reject_drafts` (reason required) | ≥1 selected non-terminal |
| Bulk publish | `bulk_publish_drafts` (per-draft results surfaced) | ≥1 selected eligible |
| Bulk archive | `bulk_archive_drafts` | ≥1 selected `rejected`/`published` — **see Known Issue** |

Publish, reject, and archive show confirmation dialogs; rejection requires a
reason (stored in `review_notes` and the `ai_draft_logs` audit trail by the
RPCs themselves).

## Archive bug — FIXED (migration `20260707124206`, applied 2026-07-07)

Historical context: `bulk_archive_drafts()` (migration `20260707014946`)
inserted `event = 'archived'` into `ai_draft_logs`, but the event CHECK
constraint (migration `20260705162807`) did not include `'archived'`, so
every call failed and rolled back.

The fix audit found a **second latent bug** in the same function: the log
insert wrote a row for *every* id passed in, not just rows actually archived.
With only the constraint fixed, that would have (a) created false `archived`
audit entries for drafts skipped due to ineligible status, and (b) violated
the `ai_draft_logs.draft_id` foreign key whenever a passed id no longer
existed — rolling the whole call back again.

Migration `20260707124206_fix_archive_event_constraint_and_bulk_archive_logging`
fixes both: the constraint now allows `'archived'`, and the function logs via
`UPDATE … RETURNING`, so audit rows exist only for drafts actually archived.
Return value is now the true archived count in all cases. Identity/admin
guards, signature, and grants are unchanged; no frontend change was needed.

Rollback: `supabase/rollbacks/rollback_20260707124206_…​.sql` (restores the
pre-fix constraint and the pre-fix — i.e. broken — function; deletes any
`archived` log rows, which the old constraint forbids; see warnings inside).

Verified in production on 2026-07-07 via rolled-back test transactions with
authenticated-role JWT claims: mixed batch (2 eligible + 1 ineligible +
1 nonexistent id) → return 2, exactly 2 audit rows; eligible-only subset →
correct count; spoofed identity rejected; matching-identity non-admin
rejected.

## Testing performed (2026-07-07)

Verified: `npm run build` green; all 9 RPC signatures matched byte-for-byte
against production `pg_proc` (read-only query); selected columns exist in the
production schema; status/transition gating mirrors the SQL guards exactly;
empty-state, loading, and error paths implemented.

Not verifiable from the build environment (requires a real admin browser
session, because the RPCs correctly reject any caller whose JWT doesn't match
`p_admin_id` — proven in the 2026-07-07 launch-readiness E2E): the positive
click-through of approve/reject/publish/bulk. `ai_drafts` is currently empty
in production. To generate review material, either run the collector
(`python scripts/generate_current_affairs_v2.py --count 2`) or insert a test
draft, then walk the manual checklist:

1. Log in as admin → `/admin/drafts` loads with health strip populated
2. Filters and search narrow the list; counts on tabs are correct
3. Preview shows content, json_data, source link
4. Edit title → save → reopen preview → version history shows v1
5. Draft in `draft` status → Validate → becomes `validated` (or shows failure reasons)
6. Approve a `validated` draft → status `approved`
7. Publish → confirmation → article appears in `current_affairs` and on the public page
8. Reject with reason → status `rejected`, reason in review notes
9. Select several → bulk approve / bulk publish → per-draft results toasts
10. Bulk archive → **expected to fail with a constraint error until the fix above is approved and applied**
