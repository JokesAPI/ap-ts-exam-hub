# Phase 5 — Previous Papers (PYQ) System completion

**Date:** 2026-07-09 · **Branch:** v2-development · Base: `53e7b6f`
**Branding:** website remains **AP TS Exam Hub**; TG used for official
Telangana entities (org labels updated TSPSC→TGPSC, TS Police→TG Police).

## Audit summary

Much of the PYQ system already existed and was **reused, not duplicated**:
- Public page: search, year filter, organization filter, exam-centric filter
  chips, subject badge display, PDF view/download.
- Admin page: full CRUD + PDF upload to the `pdfs` storage bucket.
- Schema: `previous_papers` already has `exam_id, organization, year, subject,
  description`; `bookmarks` already has a generic `item_type` (own-row RLS).

**Genuine gaps closed this phase:**
1. Bookmark papers — wired paper cards to the existing `bookmarks` table
   (`item_type='previous_papers'`), first producer for papers.
2. Recently viewed papers — new `src/lib/recentPapers.js` (localStorage,
   mirrors `testSession.js`); shown on the papers page.
3. Subject filter — added a subject dropdown (subject was stored/displayed but
   had no filter control).
4. CSV bulk import — added to AdminPapers (dependency-free parser, same
   pattern as AdminQuestions; admin-only via existing RLS).
5. Dashboard integration — the student dashboard Bookmarks section now
   hydrates paper bookmarks too, with type-aware links.

## Deferred (documented, not built)

- **AI tagging of papers** — would require real AI generation and a distinct
  workflow. Out of scope for "one logical feature"; the AI infra
  (`aiQuestionGen`, `ai_drafts`) exists to add this later without new tables.
  No difficulty/tags were fabricated.

## Database changes

**None.** No migration. Everything reuses existing columns and the existing
`bookmarks` / `previous_papers` RLS. (Satisfies "no unnecessary migrations".)

## Files changed
- `src/lib/recentPapers.js` (new)
- `src/pages/public/PreviousPapers.jsx` (bookmarks, subject filter,
  recently-viewed, TG org labels)
- `src/pages/admin/AdminPapers.jsx` (CSV bulk import, TG org labels)
- `src/pages/public/StudentDashboard.jsx` (paper bookmarks in Bookmarks
  section)
- `docs/PHASE5_PREVIOUS_PAPERS.md`, `CHANGELOG.md`

## Security review
- Paper bookmarks write through `bookmarks_own` (`auth.uid() = user_id`, ALL)
  — a user can only manage their own bookmarks. Verified: no `item_type`
  CHECK blocks `previous_papers`.
- Papers read is public; CSV import writes go through
  `previous_papers_admin_write` (admin only). Admin page already behind
  `AdminRoute`.
- No new DB objects, no service-role, no secrets in frontend. Recently-viewed
  is client-only localStorage (non-sensitive paper metadata).

## Performance review
- No new dependencies (CSV parser is inline). No migration. Bundle unchanged
  aside from small component additions.

## Testing
- `npm run build` passes.
- Bookmark toggle add/remove (own-row RLS); subject filter narrows list;
  recently-viewed persists across reloads and is capped at 8; CSV import
  parses and rejects title-less rows; dashboard shows paper bookmarks with
  correct `/previous-papers` links.
- Existing search/year/org/exam filters and PDF download unaffected.
