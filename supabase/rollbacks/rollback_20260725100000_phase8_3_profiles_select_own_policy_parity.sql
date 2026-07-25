-- Rollback for 20260725100000_phase8_3_profiles_select_own_policy_parity.sql
--
-- Restores staging's current state for this policy: no profiles_select_own
-- policy at all (public.profiles reverts to zero policies on RLS, deny-all
-- for the `authenticated` role).
--
-- *** DO NOT apply this rollback to production. ***
-- Production already depends on profiles_select_own (and has been running
-- with it in place, alongside its differently-named duplicate "Users can
-- read own profile") -- dropping it there would immediately break every
-- authenticated user's ability to load their own profile in production,
-- reproducing the exact 406/PGRST116/infinite-spinner bug this migration
-- exists to fix, but in production instead of staging. This rollback is
-- scoped to reversing THIS migration on THIS environment only.

drop policy if exists profiles_select_own on public.profiles;
