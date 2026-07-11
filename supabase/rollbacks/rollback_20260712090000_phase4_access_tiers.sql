-- ROLLBACK for 20260712090000_phase4_access_tiers
-- Restores the pre-PR-1 state exactly: untiered authenticated-only reads,
-- no anon access, no catalog table. No question content is touched.

begin;

-- restore the original single read policy
drop policy if exists mock_questions_select_anon          on public.mock_questions;
drop policy if exists mock_questions_select_authenticated on public.mock_questions;
create policy mock_questions_select_published on public.mock_questions
  for select to authenticated
  using (status = 'published');

revoke select on public.mock_questions from anon;

-- drop the catalog
drop policy if exists mock_tests_select_public on public.mock_tests;
drop policy if exists mock_tests_write_admin   on public.mock_tests;
drop table if exists public.mock_tests;

-- drop the tier column (content itself is untouched)
drop index if exists public.idx_mock_questions_test_status_tier;
alter table public.mock_questions drop constraint if exists mock_questions_access_tier_check;
alter table public.mock_questions drop column if exists access_tier;

commit;
