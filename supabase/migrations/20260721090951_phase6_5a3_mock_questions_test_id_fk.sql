-- ============================================================================
-- Phase 6.5A.3 — mock_questions.test_id foreign key
--
-- Pre-flight verified immediately before applying:
--   orphan test_id count = 0  (79 questions, 8 distinct test_ids, all resolving)
--   existing FK to mock_tests = 0  (no duplicate to conflict with)
--   null test_id = 0  (column is already NOT NULL)
--
-- Prerequisites completed in Phase 6.5A.3-pre and verified live:
--   validate_draft()  rejects question drafts whose test_id does not resolve
--   publish_draft()   refuses to publish without a validated test_id
--   AdminQuestions bulk import validates test_id existence per row
--
-- ON DELETE RESTRICT (not CASCADE): deleting a mock test must not silently
-- erase its question bank. mock_tests.is_active exists for soft-delete, which
-- is the intended lifecycle. Matches the mock_results FK from Phase 6.5A.2.
--
-- No index is created: idx_mock_questions_test_id and
-- idx_mock_questions_test_status_tier already cover the child side.
-- ============================================================================

alter table public.mock_questions
  add constraint mock_questions_test_id_fkey
  foreign key (test_id)
  references public.mock_tests (test_id)
  on delete restrict;
