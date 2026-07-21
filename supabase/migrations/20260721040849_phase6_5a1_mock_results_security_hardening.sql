-- ============================================================================
-- Phase 6.5A.1 — mock_results security hardening
--
-- Replaces the single FOR ALL policy with explicit SELECT + INSERT policies and
-- removes UPDATE/DELETE/TRUNCATE from authenticated. Attempt results are
-- append-only from the student's perspective: they are read and written by the
-- test engine, and consumed by cross-user functions (get_test_rank,
-- get_leaderboard), so a student must not be able to mutate them after the fact.
-- Verified before applying: the only write path in the repository is
-- supabase.from('mock_results').insert(...) at MockTestEngine.jsx:167.
-- ============================================================================

drop policy if exists mock_results_own on public.mock_results;

create policy mock_results_select_own
  on public.mock_results
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy mock_results_insert_own
  on public.mock_results
  for insert
  to authenticated
  with check (auth.uid() = user_id);

revoke update, delete, truncate on public.mock_results from authenticated;
