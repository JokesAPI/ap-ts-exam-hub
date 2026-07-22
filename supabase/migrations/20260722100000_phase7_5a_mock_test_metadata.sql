-- ============================================================================
-- Phase 7.5A — Flexible Test Metadata: duration_minutes + negative_mark_per_wrong
--
-- Context: MockTestEngine.jsx currently hardcodes two values for every
-- official test with no exceptions:
--   - TEST_TIME_PER_Q = 60 (seconds/question, MockTestEngine.jsx:14)
--   - negative marking = wrong / 3 (MockTestEngine.jsx:165)
-- This migration adds per-test overrides for both, so future tests can carry
-- their own duration and negative-marking scheme without a code change.
--
-- Both columns are NULLABLE BY DESIGN, not just as a migration convenience:
--   - All 8 existing mock_tests rows must keep behaving exactly as they do
--     today. NULL is the explicit signal to the frontend "use the legacy
--     hardcoded constant", not an accidental gap to be back-filled.
--   - question_count is deliberately NOT added as a column here (per approved
--     scope) -- it continues to be derived live from published mock_questions
--     rows, since a stored count would drift out of sync with the question
--     bank the moment an admin adds/removes/unpublishes a question.
--   - exam_id and any category concept are explicitly out of scope for this
--     migration -- separate, already-identified phases.
--
-- ADD COLUMN ... NULL is a metadata-only change on Postgres (11+): no default
-- value means no table rewrite and no lock beyond the brief ACCESS EXCLUSIVE
-- needed to update the catalog. All 8 existing rows get NULL in both new
-- columns automatically; nothing is backfilled or rewritten.
-- ============================================================================

alter table public.mock_tests
  add column if not exists duration_minutes integer null,
  add column if not exists negative_mark_per_wrong numeric(4,3) null;

comment on column public.mock_tests.duration_minutes is
  'Total time allotted for the test, in minutes. NULL means "not set" -- '
  'the frontend must fall back to today''s legacy behaviour of '
  '(published question count * 60 seconds), NOT treat NULL as zero.';

comment on column public.mock_tests.negative_mark_per_wrong is
  'Marks deducted per wrong answer (e.g. 0.3333 for the current -1/3 scheme). '
  'NULL means "not set" -- the frontend must fall back to today''s legacy '
  'wrong/3 formula, NOT treat NULL as zero (no negative marking).';

-- Optional sanity bounds -- both are opt-in overrides, so NULL must remain
-- valid; only reject nonsensical non-null values. negative_mark_per_wrong is
-- bounded to [0, 1] since it represents marks deducted per single wrong
-- answer -- a value above 1 would deduct more than one full mark per wrong
-- answer, which is not a real negative-marking scheme used by any exam this
-- platform targets.
alter table public.mock_tests
  add constraint mock_tests_duration_minutes_check
    check (duration_minutes is null or duration_minutes > 0),
  add constraint mock_tests_negative_mark_per_wrong_check
    check (
      negative_mark_per_wrong is null
      or (negative_mark_per_wrong >= 0 and negative_mark_per_wrong <= 1)
    );
