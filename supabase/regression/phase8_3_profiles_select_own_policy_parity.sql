-- Phase 8.3 regression check for profiles_select_own policy parity.
--
-- NOT part of `npm test` -- same reasoning as the other files in
-- supabase/regression/: that suite is network-free and has no Postgres
-- connection. Meant to be run ad hoc (SQL editor/CLI) after applying
-- 20260725100000_phase8_3_profiles_select_own_policy_parity.sql.
--
-- Unlike the other two files in this directory (which rely solely on a
-- raised exception inside a self-contained do $$ block for cleanup), this
-- one uses an explicit transaction wrapper per this task's instruction, so
-- cleanup does not depend only on an exception propagating:
--
--   begin;
--   -- validation, including one transaction-local synthetic profile row
--   -- for the cross-user denial check
--   rollback;
--
-- The trailing `rollback;` guarantees nothing here is ever persisted,
-- whether every check passes or an assertion raises partway through.
--
-- Covers:
--   - public.profiles still has RLS enabled
--   - profiles_select_own exists, command SELECT, permissive, role
--     authenticated, USING = auth.uid() = id (pg_get_expr-normalized), no
--     WITH CHECK
--   - an authenticated user can read their own row and only their own row
--     (via a transaction-local synthetic second profile row -- never
--     committed, per the trailing rollback)
--   - anon reads zero rows
--   - profiles_insert_own / profiles_update_own were NOT created by this
--     migration (out of its explicit scope)
--   - the staging admin profile (77d64975-c8d9-4c26-87fb-29675fe812b3) is
--     untouched by any of the above

begin;

do $$
declare
  v_synthetic_id uuid := '00000000-0000-4000-8000-000000000001';
  v_polcmd text;
  v_permissive bool;
  v_roles name[];
  v_using text;
  v_with_check text;
  v_rls_enabled bool;
  v_own_count int;
  v_cross_count int;
  v_anon_count int;
  v_failures text[] := '{}';
begin
  -- 1. RLS still enabled
  select relrowsecurity into v_rls_enabled
  from pg_class where oid = 'public.profiles'::regclass;

  if v_rls_enabled is distinct from true then
    v_failures := v_failures || format('RLS not enabled on public.profiles (relrowsecurity=%s)', v_rls_enabled);
  end if;

  -- 2. profiles_select_own definition
  select
    case pol.polcmd when 'r' then 'SELECT' when 'a' then 'INSERT'
                     when 'w' then 'UPDATE' when 'd' then 'DELETE' when '*' then 'ALL' end,
    pol.polpermissive,
    (select array_agg(r.rolname order by r.rolname) from pg_roles r where r.oid = any(pol.polroles)),
    pg_get_expr(pol.polqual, pol.polrelid),
    pg_get_expr(pol.polwithcheck, pol.polrelid)
  into v_polcmd, v_permissive, v_roles, v_using, v_with_check
  from pg_policy pol
  where pol.polrelid = 'public.profiles'::regclass
    and pol.polname = 'profiles_select_own';

  if v_polcmd is null then
    v_failures := v_failures || 'profiles_select_own not found on public.profiles';
  end if;

  if v_polcmd is distinct from 'SELECT' then
    v_failures := v_failures || format('expected command SELECT, got %s', coalesce(v_polcmd, 'null'));
  end if;

  if v_permissive is distinct from true then
    v_failures := v_failures || format('expected permissive policy, got %s', coalesce(v_permissive::text, 'null'));
  end if;

  if v_roles is distinct from array['authenticated']::name[] then
    v_failures := v_failures || format('expected roles {authenticated}, got %s', coalesce(v_roles::text, 'null'));
  end if;

  if v_using is null or v_using not ilike '%auth.uid()%' or v_using not ilike '%id%' then
    v_failures := v_failures || format('USING expression missing or unexpected: %s', coalesce(v_using, 'null'));
  end if;

  if v_with_check is not null then
    v_failures := v_failures || format('expected no WITH CHECK on a SELECT policy, found: %s', v_with_check);
  end if;

  -- 3. out-of-scope policies must not exist
  if exists (
    select 1 from pg_policy
    where polrelid = 'public.profiles'::regclass
      and polname in ('profiles_insert_own', 'profiles_update_own')
  ) then
    v_failures := v_failures || 'profiles_insert_own/profiles_update_own exist -- out of this migration''s scope';
  end if;

  -- 4. transaction-local synthetic row for the cross-user check (rolled
  --    back unconditionally by the trailing `rollback;` below)
  insert into public.profiles (id, is_admin)
  values (v_synthetic_id, false);

  -- as the real staging admin: must see exactly own row, not the synthetic one
  perform set_config('request.jwt.claims',
    json_build_object('sub', '77d64975-c8d9-4c26-87fb-29675fe812b3', 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select count(*) into v_own_count from public.profiles where id = '77d64975-c8d9-4c26-87fb-29675fe812b3';
  select count(*) into v_cross_count from public.profiles where id = v_synthetic_id;

  if v_own_count <> 1 then
    v_failures := v_failures || format('authenticated owner could not read their own profile (got %s rows)', v_own_count);
  end if;

  if v_cross_count <> 0 then
    v_failures := v_failures || format('authenticated user could read ANOTHER profile (got %s rows) -- cross-user leak', v_cross_count);
  end if;

  -- as anon: must see nothing
  perform set_config('request.jwt.claims', '{}', true);
  perform set_config('role', 'anon', true);

  select count(*) into v_anon_count from public.profiles;
  if v_anon_count <> 0 then
    v_failures := v_failures || format('anon could read %s profile row(s) -- should be zero', v_anon_count);
  end if;

  -- back to a privileged role so the failure/success report itself isn't RLS-filtered
  reset role;
  perform set_config('request.jwt.claims', '', true);

  if array_length(v_failures, 1) > 0 then
    raise exception 'REGRESSION FAILED (phase8_3_profiles_select_own_policy_parity): %',
      array_to_string(v_failures, ' | ');
  else
    raise notice 'REGRESSION PASSED: profiles_select_own is authenticated-only, SELECT-only, auth.uid()=id, no WITH CHECK; owner reads own row only; anon reads nothing; no out-of-scope profiles policy exists.';
  end if;
end $$;

rollback;
