-- Phase 3 follow-up (additive security hardening for mock_questions).
-- Fixes two issues found during Phase 3 security review:
--  (1) authenticated lacked SELECT → engine could not read the bank at all
--      (RLS select policy was inert). Grant SELECT so published questions load.
--  (2) anon + authenticated held blanket INSERT/UPDATE/DELETE/TRUNCATE grants.
--      Writes are meant to be admin-only (enforced by mock_questions_write_admin
--      policy). Revoke the excess grants; keep only what the policies need.
--      Admins operate via the `authenticated` role, so authenticated retains
--      INSERT/UPDATE/DELETE (still gated by the admin WITH CHECK/USING policy);
--      anon loses all write access.

begin;

-- (1) let signed-in users read (published rows only, per RLS select policy)
grant select on public.mock_questions to authenticated;

-- (2) anon must not write or read this table at all
revoke insert, update, delete, truncate, references, trigger, select
  on public.mock_questions from anon;

commit;
