-- ROLLBACKS for the four 2026-07-05 foundation migrations.
-- Sections are independent; each states whether it is active or gated.

-- ═══════════════════════════════════════════════════════════════════
-- ROLLBACK for 20260705162129_phase3_missing_indexes  (ACTIVE, safe)
-- Dropping indexes never loses data; only query performance regresses.

drop index if exists idx_mock_results_user_id;
drop index if exists idx_bookmarks_user_id;
drop index if exists idx_subscriptions_user_id;
drop index if exists idx_payments_user_id;
drop index if exists idx_mock_questions_test_id;

-- ═══════════════════════════════════════════════════════════════════
-- ROLLBACK for 20260705112901_set_initial_admin_account  (GATED)
-- DANGER: this is the ONLY admin account. Running the update below
-- locks every human out of the admin panel and the draft pipeline
-- (all admin RPCs check profiles.is_admin). Only run after another
-- admin account exists.
--
-- update public.profiles set is_admin = false
-- where email = 'shaik.income@gmail.com';

-- ═══════════════════════════════════════════════════════════════════
-- ROLLBACK for 20260705112757_fix_signup_trigger_and_backfill_profiles
-- Trigger/function reversal is ACTIVE below.
-- The data backfill is IRREVERSIBLE by design: backfilled profile rows
-- are indistinguishable from organic ones, and deleting profiles for
-- existing auth.users would orphan mock_results, subscriptions,
-- bookmarks, and payments. Do not attempt to reverse the backfill.
--
-- NOTE: after running this, NEW signups will stop getting profile rows
-- (the original bug returns). Only roll this back to immediately replace
-- the trigger with a corrected version.

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════════
-- ROLLBACK for 20260705112215_rls_content_tables_and_column_grants
-- SECURITY-GATED. The forward migration replaced ~30 permissive legacy
-- policies (public insert/update/delete on content tables!) with
-- public-read + admin-write, fixed profiles column grants, protected
-- premium fields, and hid mock_questions.correct_answer from students.
--
-- The legacy insecure policies are NOT recreated here under any section.
-- The reversal below only removes the objects this migration created,
-- leaving RLS ENABLED with no write policies (fail-closed): content
-- tables become read-only for everyone except service_role. That is the
-- safest possible "rolled back" state.

begin;

-- New policies created by the migration
drop policy if exists "current_affairs_select_public" on current_affairs;
drop policy if exists "current_affairs_admin_write"  on current_affairs;
drop policy if exists "exams_select_public"          on exams;
drop policy if exists "exams_admin_write"            on exams;
drop policy if exists "notifications_select_public"  on notifications;
drop policy if exists "notifications_admin_write"    on notifications;
drop policy if exists "previous_papers_select_public" on previous_papers;
drop policy if exists "previous_papers_admin_write"   on previous_papers;
drop policy if exists "test_registrations_insert_anyone" on test_registrations;

-- Premium-field protection trigger
drop trigger if exists trg_protect_premium_profile_fields on profiles;
drop function if exists public.protect_premium_profile_fields();

-- Restore full-table grants (reverses the column-level narrowing)
grant update on profiles to authenticated;
grant select on mock_questions to authenticated;

commit;

-- DANGER — full reversal would additionally require:
--   alter table current_affairs  disable row level security;
--   alter table exams            disable row level security;
--   alter table notifications    disable row level security;
--   alter table previous_papers  disable row level security;
-- Disabling RLS on production content tables exposes them to any
-- authenticated write. Never run these on production.
