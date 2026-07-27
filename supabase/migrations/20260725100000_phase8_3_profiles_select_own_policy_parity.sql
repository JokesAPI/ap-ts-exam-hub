-- Phase 8.3: profiles SELECT-own policy parity.
--
-- public.profiles has RLS enabled but has never had a tracked CREATE POLICY
-- for reading one's own row -- like mock_questions_write_admin before it,
-- production's `profiles_select_own` policy predates tracked migrations
-- entirely (created manually at some point). Confirmed via direct pg_policy
-- audit: production has this policy (plus a functionally-identical
-- differently-named duplicate, "Users can read own profile", which this
-- migration deliberately does not touch); the staging sandbox
-- (wkreeedwxgopygexkoxi) has zero policies on public.profiles at all, which
-- is the confirmed root cause of the 406/PGRST116 blocking the Admin
-- Questions page load (RLS enabled + no policy = deny-all for the
-- `authenticated` role, even for a user reading their own row).
--
-- This migration only re-asserts production's already-working SELECT-own
-- behavior under its exact tracked name and expression -- it does not
-- change any table, column, function, grant, trigger, user, data, or any
-- other policy (including the "Users can read own profile" duplicate).
--
-- Scope is deliberately narrow: SELECT-own only. Production also has
-- profiles_insert_own and profiles_update_own, which staging lacks too --
-- those are NOT required to unblock the Admin Questions load and are
-- intentionally left for a separate, later migration.

drop policy if exists profiles_select_own on public.profiles;

create policy profiles_select_own
on public.profiles
as permissive
for select
to authenticated
using (auth.uid() = id);
