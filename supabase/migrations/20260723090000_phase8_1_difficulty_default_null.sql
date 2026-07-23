-- Phase 8.1 -- close the difficulty silent-default landmine at the source.
--
-- Evidence (verified live against production, ijqdjlkzcygfjkmciqyy, this session):
--   mock_questions.difficulty: text, nullable, DEFAULT 'medium'::text
--   CHECK constraint mock_questions_difficulty_check already allows NULL.
--   Both currently-known insert paths (AdminQuestions.jsx buildPayload/
--   bulkImport, and the AI publish_draft() function) already explicitly
--   write `difficulty: null` / `nullif(j->>'difficulty','')` -- this
--   DEFAULT is not currently reached by any known code path, but relies on
--   every *future* insert path remembering to do the same. This migration
--   removes that reliance permanently.
--
-- This is a metadata-only change: no table rewrite, no row touched, no
-- change to the CHECK constraint, no change to existing easy/medium/hard/
-- NULL values. Confirmed via information_schema this session:
--   42 easy, 32 medium, 5 hard, 10 NULL (unaffected by this migration).
--
-- Does NOT touch validate_draft()/publish_draft() -- confirmed this
-- session that both already write difficulty explicitly via nullif(),
-- independent of this column default, so they are unaffected either way.

alter table mock_questions
  alter column difficulty set default null;
