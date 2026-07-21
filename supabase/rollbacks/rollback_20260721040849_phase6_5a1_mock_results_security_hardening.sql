-- ROLLBACK for 20260721040849_phase6_5a1_mock_results_security_hardening
-- Restores the previous single FOR ALL policy and the prior grants.
--
-- WARNING: this reinstates the ability for a student to UPDATE and DELETE their
-- own mock_results rows, which feed cross-user get_test_rank and
-- get_leaderboard. Treat as a temporary measure, not a resting state.

drop policy if exists mock_results_select_own on public.mock_results;
drop policy if exists mock_results_insert_own on public.mock_results;

create policy mock_results_own
  on public.mock_results
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant update, delete, truncate on public.mock_results to authenticated;
