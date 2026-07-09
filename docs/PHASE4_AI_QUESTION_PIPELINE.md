# Phase 4 — AI Content Automation (Question Pipeline)

**Date:** 2026-07-09 · **Branch:** v2-development · Base: `1d37948`
**Branding:** website remains **AP TS Exam Hub**; official TG naming used in content.

## Audit summary

Most Phase 4 scope already existed and was **reused, not duplicated**:
`AdminDrafts.jsx` already provides the full review queue (pending/approved/
rejected/published/archived, preview, approve, reject, publish, archive, bulk
actions, search, filters, health dashboard) backed by RPCs
(`validate_draft`, `approve_draft`, `reject_draft`, `publish_draft`,
`bulk_*`, `check_duplicate_draft`, `get_automation_health`). The Groq backend
(`/api/groq-chat`, key server-side) and CA generator already existed. Phase 3
already allowed `ai_drafts.content_type='questions'`.

**The genuine gaps closed this phase:**
1. `validate_draft()` and `publish_draft()` had **no questions branch** — a
   questions draft could be created but never validated or published
   (`publish_draft` raised `Unknown content_type: questions`). This blocked
   the entire question pipeline.
2. No **AI question generator** (generate MCQs → drafts).
3. No **explanation enrichment** generator.
4. Bulk import was JSON-only; no CSV.

## Implementation

**Database (one additive migration + rollback).**
`20260709140000_phase4_publish_validate_questions` extends both workflow
functions with a `questions` branch (`create or replace`, signatures
unchanged, all four existing content types preserved byte-for-byte):
- `validate_draft`: validates question stem, four options, answer letter
  (A–D), **required explanation**, difficulty (easy/medium/hard), and rejects
  an exact-duplicate published question — satisfying the Phase 4 validation
  rules (duplicate / invalid answer / invalid options / missing explanation).
- `publish_draft`: inserts a validated/approved questions draft into
  `mock_questions` as `status='published'`, `ai_generated=true`,
  `human_verified=true`, `created_by/reviewed_by=admin`, resolving `exam_id`
  from `json_data.exam_slug`. `test_id` (NOT NULL) defaults to
  test_id → exam_slug → 'general'.

Both remain `SECURITY DEFINER` with the admin gate and `auth.uid()` identity
check. RLS unchanged; no new tables/policies.

> Reconciliation note: a first apply of this migration was corrected in-session
> for a `test_id` NOT-NULL bug caught by the pre-commit test; the live
> functions and the committed migration file both contain the fix. The
> Supabase `schema_migrations` statement cache holds the pre-fix text for this
> version; it is cosmetic (used only for `db pull` reconstruction) and the
> committed file is canonical.

**Frontend (extends existing AdminQuestions; no new admin page).**
- `src/lib/aiQuestionGen.js` (new): reuses `callGroq` (server-side backend).
  `generateQuestionDrafts()` builds an exam/subject/topic prompt, calls Groq,
  parses JSON, runs client-side checks + in-batch dedupe, and inserts valid
  items into `ai_drafts` as `content_type='questions'`, `status='draft'`.
  Nothing is published. `generateExplanation()` produces detailed/short
  explanation, key points, memory trick, common mistakes, difficulty
  reasoning for enrichment.
- `AdminQuestions.jsx`: "AI Generate" modal (10/25/50/100 for exam/subject/
  topic → drafts) and CSV load (dependency-free parser → same draft import
  path). Excel is handled via CSV export (no heavy `xlsx` dependency added,
  per the performance rule).

## Files changed
- `supabase/migrations/20260709140000_phase4_publish_validate_questions.sql` (new)
- `supabase/rollbacks/rollback_20260709140000_...sql` (new)
- `src/lib/aiQuestionGen.js` (new)
- `src/pages/admin/AdminQuestions.jsx` (AI generate + CSV)
- `docs/PHASE4_AI_QUESTION_PIPELINE.md`, `CHANGELOG.md`

## Security review
- `publish_draft` / `validate_draft`: SECURITY DEFINER, admin-gated,
  `auth.uid()` identity check — verified in production.
- `ai_drafts` admin-only RLS and `mock_questions` policies unchanged.
- Groq key stays server-side (`/api/groq-chat`); no secret in frontend; all
  AI calls are server-proxied.
- Generated/imported questions ALWAYS enter as drafts; never auto-published.

## Testing
- Full pipeline (transaction, rolled back): create questions draft →
  `validate_draft` (0 failures) → `publish_draft` as admin → verified
  `mock_questions` row (published, ai_generated, exam linked, answer/tags
  correct). Bad draft → validate returned `missing_options`,
  `invalid_correct_answer`, `missing_explanation`. Pre-commit test caught the
  `test_id` NOT-NULL bug, which was fixed and re-verified.
- `npm run build` passes; existing CA pipeline and AdminDrafts untouched.

## Not fabricated
No sample AI questions were invented as fixtures; generation runs against the
live Groq key in the deployed environment. No Groq "credits" number is shown
(the analytics use real draft/question counts only).
