-- ROLLBACK for 20260721043707_phase6_5a2_mock_results_integrity_hardening
-- Both statements are metadata-only. No table rewrite, no data loss.
-- Apply ONLY if a regression is traced to this change.

alter table public.mock_results
  drop constraint if exists mock_results_test_id_fkey;

alter table public.mock_results
  alter column user_id drop not null;
