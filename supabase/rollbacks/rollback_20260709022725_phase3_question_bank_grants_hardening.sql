-- ============================================================================
-- ROLLBACK for 20260709022725_phase3_question_bank_grants_hardening
--
-- Restores the pre-hardening grant state on mock_questions. NOTE: the original
-- state had broad grants to anon/authenticated; restoring them re-opens the
-- table. Prefer NOT rolling this back unless also rolling back the foundation
-- migration. Provided for completeness.
-- ============================================================================

begin;

-- revert (1): remove the explicit authenticated SELECT grant
revoke select on public.mock_questions from authenticated;

-- revert (2): restore anon's prior grants (pre-hardening blanket access)
grant insert, update, delete, truncate, references, trigger, select
  on public.mock_questions to anon;

commit;
