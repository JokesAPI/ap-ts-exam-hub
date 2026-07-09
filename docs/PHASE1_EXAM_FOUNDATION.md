# Phase 1 — Exam-Centric Foundation

**Date:** 2026-07-08 · **Branch:** v2-development · Base: `bb3af3e`

## Provenance note (important)

Phase 1 was partially implemented by a **parallel working session** that (a)
applied two migrations directly to production without committing them to the
repo (`20260708013156_mock_test_rank_prediction`,
`20260708061409_phase1_exam_centric_foundation` — the latter seeded the
27-exam catalog), and (b) left uncommitted frontend work in the workspace.
This commit **consolidates** everything: reconciles the repo with production
migration history (byte-verified), reviews and adopts the sound frontend
work, and applies one corrective migration for the owner-approved deltas the
parallel work missed. Detected per the concurrent-modification safety rule;
consolidation explicitly approved by the owner (Option A).

## Repo ↔ production migration reconciliation

Two migrations existed in production but not in the repo. Both were extracted
from `supabase_migrations.schema_migrations` via single-line base64 and are
now committed **byte-identical** (verified: transport md5 and content md5
match production — `689b93a7…` for 013156, `344326d1…` for 061409). An
unapplied stale draft (`20260708150000_*`) that would have duplicated the
catalog was deleted from the workspace and never committed.

Known version-string quirk: migrations applied via the Supabase MCP get a
server-assigned version. Mapping for older files: repo `20260708053000` =
prod `20260708010536`; repo `20260708113000` = prod `20260708055432`. From
this phase on, repo filenames use the production version string.

## Corrective migration — `20260708112948_phase1_catalog_corrections`

Applied to production and verified. Contents: canonical APPSC Group-2 moved
to the oldest content-rich UUID `fa4bfb17` (slug + metadata transferred,
references repointed, the two approved duplicates deleted); "Services"
titles for the six PSC groups; TG display naming and **final slug set**
(`tg-dsc`, `tg-police-si`, `tg-police-constable` — renamed pre-release, the
only safe moment); catalog additions SSC MTS and SBI Clerk (29 canonical
exams, all slugged, zero duplicates); the missing
`GRANT UPDATE (selected_exam_id)` that made exam-saving impossible; a
slug-immutability trigger (`trg_exams_protect_slug`) blocking slug changes
from `authenticated`/`anon` forever (server roles exempt for maintenance);
and additive `previous_papers` columns (`organization, year, subject,
description`) fixing the page's long-broken `order by year` query, with
`organization` backfilled from `exam_category`.

**Slugs are now frozen.** The permanent slug set is the 29 values in
production; the trigger enforces it. Never rename — add a new row instead.

## Frontend (reviewed line-by-line; parallel session's work adopted)

Adopted as-is after review: `src/context/ExamContext.jsx` (catalog fetch,
profile-wins resolution, guest localStorage, one-time guest→profile sync,
instant local override, error toasts), `src/components/ExamPicker.jsx`
(category-grouped modal reusing `Modal`), Navbar exam chip (desktop +
mobile), `main.jsx` provider wiring (`ExamProvider` inside `AuthProvider`),
dashboard "Preparing for" chip + one-time picker prompt (sessionStorage
guard), MockTests "For <exam> / All Tests" filter (documented string bridge
until Phase 2), PreviousPapers exam filter (inert until papers are tagged in
Phase 7). Review findings: `fetchProfile` dependency confirmed exported by
AuthContext; no security issues; no service keys; no duplicate components.

Added by this session: "Set as my exam" action on `/exams` cards.

## Future-relationship readiness (verified, not implemented)

`exams.id uuid` PK is the single anchor. `profiles.selected_exam_id` and
`previous_papers.exam_id` demonstrate the FK pattern that subjects,
chapters, topics, question bank, mock tests, study material, notifications,
current-affairs tags (junction, Phase 8), analytics, and AI recommendation
context will reuse. `slug` gives stable SEO URLs (Phase 9); `category` /
`state` / `display_order` / `is_active` support picker UX and lifecycle.
Multi-exam later = a `user_exams` junction; the single primary FK does not
preclude it.

## Verification evidence (all against production, all test writes rolled back)

Simulated authenticated session (real JWT claims): saving and *changing*
`selected_exam_id` both succeed (assertions passed: set to `appsc-group-2`,
then updated to `tg-eapcet`; the single production profile was restored to
NULL afterward); catalog readable (29 rows). Slug change as authenticated →
blocked: "Exam slugs are permanent and cannot be changed." `is_pro` update
as authenticated → blocked (42501, column-grant model intact — subscription
protection unregressed). Page queries all pass: exams `order by exam_date`
(Home widget + /exams + AdminExams), previous_papers `order by year`,
AdminExams full column set. Rollback dry-run executed inside a transaction:
restores exactly the pre-correction state (29 rows / 2 unslugged / seed row
regains slug / papers columns dropped), then reverted; production confirmed
still in corrected state afterward.

## Rollback

`supabase/rollbacks/rollback_20260708112948_phase1_catalog_corrections.sql` —
full restore including re-inserting both deleted duplicates with original
UUIDs, data, and timestamps. Caveats documented in the file: rolling back
re-breaks exam saving and /previous-papers (that *was* the prior state).
The two reconciled migrations (013156, 061409) are history records of what
production already ran — do not "roll back" those files by deletion; revert
their effects only via a forward migration if ever needed.
