-- Rollback for 20260724130000_phase8_3_mock_questions_admin_policy_parity.sql
--
-- Restores the previously observed bootstrap definition of
-- mock_questions_write_admin: role binding not pinned to `authenticated`
-- (defaults to PUBLIC) and no explicit WITH CHECK. This is the state the
-- policy was found in on the staging sandbox prior to this migration -- not
-- production's state, and not a recommended target. It exists only so this
-- migration is reversible in the same all-or-nothing style as every other
-- tracked migration/rollback pair in this repo.

drop policy if exists mock_questions_write_admin on public.mock_questions;

create policy mock_questions_write_admin on public.mock_questions
  as permissive
  for all
  using (
    exists (
      select 1
      from profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );
