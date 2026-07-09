# Admin Metrics & Automation Dashboard

**Date:** 2026-07-09 · **Branch:** v2-development · Base: `81acf78`
**Branding:** website remains **AP TS Exam Hub**; TG used only for official
Telangana entities.

## Audit summary

Phases 1–4 confirmed present at HEAD `81acf78` (Phase 4 pushed). Already
existed and reused, not duplicated: `AdminDrafts` review queue + automation
health strip, the `get_automation_health` RPC, `automation_runs` /
`automation_dead_letter` / `automation_sources` tables, and the AI question
pipeline. The admin dashboard showed only four content counts and there was
no dedicated automation/monitoring page — the genuine gaps closed here.

## What was added

**Database (one additive migration + rollback).**
`20260709160000_phase5_question_metrics_rpc`:
- `get_question_metrics()` — admin-gated (`auth.uid()` is_admin check),
  SECURITY DEFINER, `search_path` pinned. Returns real counts only: total /
  published / draft / in_review, ai_generated, human_verified, pending
  question drafts, published-today, plus by-exam, by-subject, by-difficulty
  breakdowns and the last 10 `ai_draft_logs` events. One round-trip for the
  whole dashboard.
- Hardening: `get_automation_health` was admin-gated internally but anon held
  EXECUTE via PUBLIC. Revoked EXECUTE from PUBLIC and re-granted to
  authenticated + service_role on both functions (anon now denied — verified).

**Frontend.**
- `AdminDashboard.jsx`: new Question Bank metrics section (6 real stat cards +
  by-subject and by-exam breakdowns) via `get_question_metrics`. Additive;
  existing content-count cards and quick actions unchanged.
- `AdminAutomation.jsx` (new, `/admin/automation`): health cards (pending,
  published today, total processed, duplicates caught, open dead-letter,
  success rate), last run / last success / last failure, a sources table, and
  recent AI activity from `ai_draft_logs`. All values come from the two
  existing/new RPCs — **no fabricated numbers** (e.g. no Groq "credits"). The
  success rate is computed from real published/rejected source aggregates and
  shows "—" when there's no data yet.
- Nav link added; route is **lazy-loaded** (separate ~6.85 kB chunk) so it
  doesn't grow the main bundle.

## Files changed
- `supabase/migrations/20260709160000_phase5_question_metrics_rpc.sql` (new)
- `supabase/rollbacks/rollback_20260709160000_...sql` (new)
- `src/pages/admin/AdminAutomation.jsx` (new)
- `src/pages/admin/AdminDashboard.jsx` (metrics section)
- `src/App.jsx` (lazy route + Suspense)
- `src/components/AdminLayout.jsx` (nav link)
- `docs/ADMIN_METRICS_AUTOMATION.md`, `CHANGELOG.md`

## Security review
- Both metrics RPCs admin-gated (is_admin), SECURITY DEFINER, search_path
  pinned; anon EXECUTE removed from both (verified: anon=false, auth=true).
- No table/RLS changes; no service-role in frontend; no secrets exposed.
- New route behind `AdminRoute`.

## Performance review
- No new dependencies. Automation page lazy-loaded (own chunk); main bundle
  unchanged aside from a tiny metrics call. Dashboard uses ONE RPC instead of
  N client count queries.

## Testing
- `get_question_metrics` verified for an admin (returns real counts);
  anon/authenticated privilege checks confirmed.
- `npm run build` passes; lazy chunk confirmed in output.
- Existing AdminDrafts, AI pipeline, and content counts unaffected.
