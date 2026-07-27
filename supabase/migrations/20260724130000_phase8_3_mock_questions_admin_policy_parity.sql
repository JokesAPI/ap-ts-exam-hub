-- Phase 8.3 policy parity: mock_questions_write_admin.
--
-- mock_questions_write_admin has never had a tracked CREATE POLICY in this
-- repo's migration history -- it's referenced as already existing (and
-- deliberately left unchanged) as far back as 20260712090000_phase4_access
-- _tiers.sql ("mock_questions_write_admin is unchanged and still governs
-- all writes"). Like pg_trgm before Phase 8.3, it was created manually at
-- some point pre-dating tracked migrations. This is the first migration to
-- give it a canonical, tracked definition.
--
-- This migration only re-asserts the ALREADY-INTENDED production behavior
-- for this one policy -- it does not change any table, column, trigger,
-- other policy, function, RPC, index, or grant.
--
-- Effective production behavior before this migration (confirmed via direct
-- pg_policy audit): role bound to `authenticated`, USING and WITH CHECK both
-- set to the same admin-membership check. This migration makes that
-- definition explicit and tracked so any environment applying this
-- migration list from scratch reaches the same state production is already
-- in -- it is not a behavior change on production.
--
-- Uses unqualified `profiles` (not `public.profiles`) to match the only
-- three existing references to this table across the migration history
-- (20260712090000, 20260721045809, 20260721140000) -- all unqualified, zero
-- qualified precedent anywhere in this repo.

drop policy if exists mock_questions_write_admin on public.mock_questions;

create policy mock_questions_write_admin on public.mock_questions
  as permissive
  for all
  to authenticated
  using (
    exists (
      select 1
      from profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  )
  with check (
    exists (
      select 1
      from profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );
