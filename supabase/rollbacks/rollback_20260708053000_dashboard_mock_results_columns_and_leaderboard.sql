-- ============================================================================
-- ROLLBACK for 20260708053000_dashboard_mock_results_columns_and_leaderboard
--
-- WARNING (data loss): dropping the five mock_results columns permanently
-- deletes any values stored in them (test_title, marks, percentage,
-- accuracy, subject_stats). Rows themselves are preserved.
--
-- NOTE: after rollback, MockTestEngine.jsx result saving breaks again
-- (its insert references these columns). Only roll back together with a
-- frontend revert, or accept broken result saving.
-- ============================================================================

begin;

drop function if exists public.get_leaderboard(integer);

drop index if exists public.idx_mock_results_user_created;

alter table public.mock_results
  drop column if exists test_title,
  drop column if exists marks,
  drop column if exists percentage,
  drop column if exists accuracy,
  drop column if exists subject_stats;

commit;
