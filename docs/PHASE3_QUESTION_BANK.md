# Phase 3 — Question Bank & AI Content Foundation

**Date:** 2026-07-09 · **Branch:** v2-development · Base: `0d7699e`

## Audit summary

Two disconnected question systems existed: a hardcoded `QUESTION_BANK` in
`src/lib/questions.js` (what the engine actually used) and an **unused
`mock_questions` table** (75 rows, `test_id/question/options/correct_answer/
explanation/subject/difficulty`) that no code read or wrote. A mature
`ai_drafts` review pipeline existed but its `content_type` did not allow
questions. No hierarchy tables, no admin question UI.

**Hybrid decision (per owner):** treat `mock_questions` as the canonical
repository and extend it additively — **no second permanent question table**.
Reuse the `ai_drafts` pipeline for AI questions by allowing a `'questions'`
content_type. Data audit before design: 75 rows, 8 `test_id`s, difficulty
already clean (easy/medium/hard, 0 nulls), all explanations present, all
answers valid A–D.

## Column justifications (requirement 11)

Every added column maps to a Phase 3 requirement; all nullable/defaulted for
backward compatibility:

| Column | Why | Default |
|---|---|---|
| `exam_id` FK→exams | link questions to the exam catalog | NULL (topic pools are exam-agnostic) |
| `topic`, `subtopic` | Exam→Subject→Topic→Subtopic hierarchy | NULL |
| `language` | multilingual (mirrors `ai_drafts.language`) | 'en' |
| `source`, `source_year` | provenance / PYQ tagging | NULL |
| `tags` text[] | flat-list filtering (array > jsonb for a list) | '{}' |
| `status` | draft→published workflow (domain checked) | 'published' (keeps 75 rows & engine unchanged) |
| `created_by`, `reviewed_by` FK→profiles | authorship / review audit | NULL |
| `ai_generated`, `human_verified` | provenance flags | false / true (existing rows are human content) |
| `published_at`, `updated_at` | lifecycle (trigger keeps updated_at fresh) | NULL / now() |
| `metadata` jsonb | future AI-gen model/confidence/prompt without schema churn | '{}' |

**Rejected alternatives:** (a) separate `subjects/topics/subtopics` tables —
over-normalization for 8 topics / 75 rows and against the "no second table"
directive; columns keep it additive and a lookup table remains a future
option. (b) dedicated `question_drafts` table — unnecessary; `status` on the
questions table itself provides the workflow, and the existing `ai_drafts`
pipeline (now with `'questions'`) handles AI review — no duplicated workflow
logic.

## Database changes (two additive migrations, both applied + verified)

**`20260709022206_phase3_question_bank_foundation`** — the 15 columns above;
`status` and `difficulty` CHECK domains (added guarded/idempotent); backfill
of provenance + `published_at=created_at` on the 75 rows (repeatable: only
touches rows still at defaults); exam-FK backfill for the two unambiguous
matches (`appsc-gs-1`→appsc-group-1, `tspsc-gs-1`→tspsc-group-1) — the other
6 topic pools left NULL (no fabrication); 6 filter indexes; `updated_at`
trigger; **narrowed select policy to published-only**; extended
`ai_drafts.content_type` CHECK to include `'questions'`.

**`20260709022725_phase3_question_bank_grants_hardening`** — fixes two issues
found *during* the security review: (1) `authenticated` had **no SELECT
grant**, so the engine could never read the bank (RLS select was inert) —
granted SELECT; (2) `anon` + `authenticated` held blanket
INSERT/UPDATE/DELETE/TRUNCATE — revoked all of anon's grants (anon now has
none), leaving admin writes gated by the existing `mock_questions_write_admin`
policy.

Both have rollbacks in `supabase/rollbacks/`. Repo files match production
version strings.

## Engine integration (backward compatible)

New `loadQuestionsForTest(supabase, testId)` in `questions.js`: DB-first
(published rows for the `test_id`), falling back to the hardcoded
`QUESTION_BANK` when the DB has none or errors. The engine's `loadQuestions`
is now async and uses it. The sync `getQuestionsForTest` is retained as the
fallback. Existing tests keep working; the two sources coexist during
migration (requirement 8).

## Admin Question Bank (`/admin/questions`)

Reuses AdminLayout + Modal + toast (AdminPapers/AdminDrafts patterns). CRUD;
search; filters (exam/subject/difficulty/status); bulk JSON import (**always
enters as drafts — never auto-published**); multi-select bulk
approve/publish/reject; full field editor incl. hierarchy, language, source,
tags, status; AI-generated badge. Client-side validation enforces the DB's
NOT-NULL options (all four required).

## AI question pipeline

AI questions reuse the existing `ai_drafts` workflow (now `content_type =
'questions'`): they enter as drafts, go through the existing review/approve
path, and are only inserted into `mock_questions` as `status='published'`
after human approval. **AI content is never published directly** — the
published-only select policy guarantees draft/in-review AI questions never
reach the engine.

## Security review

- `mock_questions`: RLS on; `mock_questions_select_published` (authenticated,
  `status='published'`) + `mock_questions_write_admin` (admin ALL). Verified
  with a simulated non-admin session: drafts_visible=0, published_visible=75.
  Admin (only current profile) sees all via the admin policy — expected.
- Grants hardened: anon has **no** grants; authenticated has SELECT (+ writes
  gated by admin policy).
- No service-role usage anywhere in frontend. Admin route behind AdminRoute.
- `ai_drafts` policies unchanged (admin-only).

## Testing

- `npm run build` passes.
- Migration verified: 75 rows preserved, all published/verified, 20
  exam-linked, 0 null published_at, constraints + indexes + trigger present,
  `ai_drafts` accepts 'questions'.
- RLS: non-admin sees only published (0 drafts); anon blocked entirely.
- Engine: DB-first loader returns published rows; falls back to built-in bank
  on empty/error (existing tests unaffected).
- Admin CRUD/import/bulk verified against schema (NOT-NULL options enforced
  client-side).

## Not done (out of scope / future)

- Migrating the hardcoded `QUESTION_BANK` content into the table is
  intentionally gradual (both sources coexist now). No SEO/perf/launch work.
