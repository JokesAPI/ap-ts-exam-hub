-- Phase 8.3 regression check for mock_questions_write_admin policy parity.
--
-- NOT part of `npm test` -- same reasoning as
-- supabase/regression/phase6_5c2_ai_exam_publish.sql: that suite is
-- network-free and has no Postgres connection. This is meant to be run ad
-- hoc against a project (via the Supabase SQL editor/CLI) after applying
-- 20260724130000_phase8_3_mock_questions_admin_policy_parity.sql, to confirm
-- the policy landed exactly as intended. Read-only catalog inspection only
-- -- it never writes to any table, so nothing here needs a rollback, but it
-- still uses the raise-based pass/fail convention for consistency with the
-- rest of supabase/regression/.
--
-- Covers:
--   - policy exists on public.mock_questions
--   - command is ALL
--   - role is exactly {authenticated} (not PUBLIC/empty)
--   - both USING and WITH CHECK are present (neither is null)
--   - both expressions reference the same admin-membership check
--   - no other policy on mock_questions was touched by this migration

do $$
declare
  v_roles text[];
  v_using text;
  v_with_check text;
  v_cmd text;
  v_other_policy_count int;
  v_failures text[] := '{}';
begin
  select
    (select array_agg(rolname) from pg_roles where oid = any(pol.polroles)),
    pg_get_expr(pol.polqual, pol.polrelid),
    pg_get_expr(pol.polwithcheck, pol.polrelid),
    case pol.polcmd when 'r' then 'SELECT' when 'a' then 'INSERT'
                     when 'w' then 'UPDATE' when 'd' then 'DELETE' when '*' then 'ALL' end
  into v_roles, v_using, v_with_check, v_cmd
  from pg_policy pol
  where pol.polrelid = 'public.mock_questions'::regclass
    and pol.polname = 'mock_questions_write_admin';

  if v_roles is null then
    v_failures := v_failures || 'policy mock_questions_write_admin not found on public.mock_questions';
  end if;

  if v_cmd is distinct from 'ALL' then
    v_failures := v_failures || format('expected command ALL, got %s', coalesce(v_cmd, 'null'));
  end if;

  if v_roles is distinct from array['authenticated']::name[] then
    v_failures := v_failures || format('expected roles {authenticated}, got %s', coalesce(v_roles::text, 'null'));
  end if;

  if v_using is null then
    v_failures := v_failures || 'USING expression is null';
  elsif v_using not ilike '%is_admin%' or v_using not ilike '%auth.uid()%' then
    v_failures := v_failures || 'USING expression does not reference the expected admin check';
  end if;

  if v_with_check is null then
    v_failures := v_failures || 'WITH CHECK expression is null (this is exactly the pre-migration defect)';
  elsif v_with_check not ilike '%is_admin%' or v_with_check not ilike '%auth.uid()%' then
    v_failures := v_failures || 'WITH CHECK expression does not reference the expected admin check';
  end if;

  if v_using is not null and v_with_check is not null and v_using is distinct from v_with_check then
    v_failures := v_failures || 'USING and WITH CHECK expressions differ; they are expected to be identical';
  end if;

  -- Scope check: this migration must not have touched any other policy on
  -- mock_questions (mock_questions_select_anon, mock_questions_select_authenticated).
  select count(*) into v_other_policy_count
  from pg_policy
  where polrelid = 'public.mock_questions'::regclass
    and polname <> 'mock_questions_write_admin';

  if v_other_policy_count <> 2 then
    v_failures := v_failures || format(
      'expected exactly 2 other policies on mock_questions (select_anon, select_authenticated), found %s',
      v_other_policy_count
    );
  end if;

  if array_length(v_failures, 1) > 0 then
    raise exception 'REGRESSION FAILED (phase8_3_mock_questions_admin_policy_parity): %',
      array_to_string(v_failures, ' | ');
  else
    raise notice 'REGRESSION PASSED: mock_questions_write_admin is authenticated-only with matching USING/WITH CHECK admin checks; no other mock_questions policy was touched.';
  end if;
end $$;
