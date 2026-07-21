-- ============================================================================
-- Phase 6.5A.2 — mock_results integrity hardening
--
-- Approved by the Phase 6.5A.2 investigation. Scope: two constraints on
-- mock_results only. mock_questions.test_id FK is deliberately NOT included --
-- it remains Phase 6.5A.3, blocked on publish_draft()'s 'general' fallback and
-- the AdminQuestions bulk-import validator.
--
-- Pre-flight verified immediately before applying:
--   mock_results.user_id NULL count   = 0
--   mock_results.test_id orphan count = 0
-- ============================================================================

-- Task 1: ownership becomes structural rather than incidental. Both RLS
-- policies key on auth.uid() = user_id, so a NULL-owner row would already be
-- invisible to every student; NOT NULL makes that guarantee enforced.
alter table public.mock_results
  alter column user_id set not null;

-- Task 2: attempts must reference a real mock test.
-- ON DELETE RESTRICT (not CASCADE): deleting a mock test must never erase
-- student attempt history. mock_tests.is_active exists for soft-delete, which
-- is the intended lifecycle. SET NULL is not available -- test_id is NOT NULL.
alter table public.mock_results
  add constraint mock_results_test_id_fkey
  foreign key (test_id)
  references public.mock_tests (test_id)
  on delete restrict;
