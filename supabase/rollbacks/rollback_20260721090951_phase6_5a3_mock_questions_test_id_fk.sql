-- ROLLBACK for 20260721090951_phase6_5a3_mock_questions_test_id_fk
-- Metadata-only. Instant, no table rewrite, no data loss.
--
-- WARNING: reverting removes the only enforcement that a question belongs to a
-- real mock test. Deleting a mock_tests row would again silently orphan its
-- entire question bank. Treat as a temporary measure, not a resting state.

alter table public.mock_questions
  drop constraint if exists mock_questions_test_id_fkey;
