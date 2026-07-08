-- ============================================================================
-- 20260708053000_dashboard_mock_results_columns_and_leaderboard
--
-- Part of: Priority 1 — Student Dashboard Completion
--
-- (1) P0 FIX — mock_results schema mismatch.
--     MockTestEngine.jsx has been inserting test_title, marks, percentage,
--     accuracy and subject_stats since the results engine was built, but
--     these columns never existed in production. Every insert failed with a
--     PostgREST "column not found" error that was only logged to the browser
--     console. Verified in production on 2026-07-08: mock_results contains
--     0 rows. Adding the columns makes the existing insert work unchanged
--     (no frontend engine change required).
--
-- (2) Composite index for the dashboard's dominant query
--     (WHERE user_id = ? ORDER BY created_at DESC).
--
-- (3) get_leaderboard() RPC. mock_results is protected by the own-rows RLS
--     policy "mock_results_own", so a cross-user leaderboard cannot (and
--     must not) be queried from the client. This SECURITY DEFINER function
--     exposes only anonymised aggregates: abbreviated display name
--     ("Ravi K."), tests taken, average %, best %. Execute is granted to
--     authenticated only — anon and public are revoked.
-- ============================================================================

begin;

-- (1) Columns the frontend already sends -------------------------------------
alter table public.mock_results
  add column if not exists test_title    text,
  add column if not exists marks         numeric(8,2),
  add column if not exists percentage    integer,
  add column if not exists accuracy      integer,
  add column if not exists subject_stats jsonb;

-- (2) Index for dashboard history query --------------------------------------
create index if not exists idx_mock_results_user_created
  on public.mock_results (user_id, created_at desc);

-- (3) Leaderboard RPC ---------------------------------------------------------
create or replace function public.get_leaderboard(limit_count integer default 10)
returns table (
  rank            bigint,
  display_name    text,
  tests_taken     bigint,
  avg_percentage  numeric,
  best_percentage numeric,
  is_me           boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with agg as (
    select
      r.user_id,
      count(*) as tests_taken,
      round(avg(coalesce(r.percentage,
                (r.score::numeric / nullif(r.total, 0)) * 100)), 1) as avg_percentage,
      round(max(coalesce(r.percentage,
                (r.score::numeric / nullif(r.total, 0)) * 100)), 1) as best_percentage
    from mock_results r
    where r.user_id is not null
    group by r.user_id
  ),
  ranked as (
    select
      row_number() over (order by a.avg_percentage desc nulls last,
                                  a.tests_taken desc) as rank,
      case
        when p.full_name is null or btrim(p.full_name) = '' then 'Student'
        else split_part(btrim(p.full_name), ' ', 1)
             || case when strpos(btrim(p.full_name), ' ') > 0
                     then ' ' || left(split_part(btrim(p.full_name), ' ', 2), 1) || '.'
                     else '' end
      end as display_name,
      a.tests_taken,
      a.avg_percentage,
      a.best_percentage,
      (a.user_id = auth.uid()) as is_me
    from agg a
    left join profiles p on p.id = a.user_id
  )
  select rank, display_name, tests_taken, avg_percentage, best_percentage, is_me
  from ranked
  where auth.uid() is not null            -- defense in depth: signed-in only
  order by rank
  limit greatest(1, least(coalesce(limit_count, 10), 50));
$$;

revoke all on function public.get_leaderboard(integer) from public;
revoke all on function public.get_leaderboard(integer) from anon;
grant execute on function public.get_leaderboard(integer) to authenticated;
grant execute on function public.get_leaderboard(integer) to service_role;

commit;
