-- ============================================================================
-- 20260708113000_codify_get_test_rank_rpc
--
-- Part of: Priority 2 — Mock Test Improvements (rank prediction)
--
-- AUDIT FINDING: get_test_rank() already existed in production (created in a
-- prior working session) but was MISSING from the repo's migration folder —
-- a source-of-truth gap. This migration codifies the exact production
-- definition so GitHub matches production. Applying it is a safe no-op
-- re-apply (create or replace + idempotent grants).
--
-- Semantics: for a given test and percentage, returns the attempt pool size,
-- how many attempts scored strictly higher, the caller's percentile, and the
-- predicted rank (better_count + 1). Aggregate-only output — no user ids,
-- names, or row-level data ever leaves the function.
--
-- Security: SECURITY DEFINER (required because mock_results own-rows RLS
-- correctly blocks cross-user reads from clients), search_path pinned,
-- internal auth.uid() guard, EXECUTE for authenticated only.
-- ============================================================================

begin;

create or replace function public.get_test_rank(p_test_id text, p_percentage numeric)
returns table (
  total_attempts bigint,
  better_count   bigint,
  percentile     numeric,
  predicted_rank bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with pool as (
    select coalesce(r.percentage,
                    (r.score::numeric / nullif(r.total, 0)) * 100) as pct
    from mock_results r
    where r.test_id = p_test_id
      and r.user_id is not null
      and auth.uid() is not null   -- defense in depth: signed-in callers only
  )
  select
    count(*)::bigint                                           as total_attempts,
    (count(*) filter (where pct > p_percentage))::bigint       as better_count,
    case when count(*) = 0 then 100
         else round(100.0 * count(*) filter (where pct <= p_percentage)
                    / count(*), 1)
    end                                                        as percentile,
    (count(*) filter (where pct > p_percentage))::bigint + 1   as predicted_rank
  from pool;
$$;

revoke all on function public.get_test_rank(text, numeric) from public;
revoke all on function public.get_test_rank(text, numeric) from anon;
grant execute on function public.get_test_rank(text, numeric) to authenticated;
grant execute on function public.get_test_rank(text, numeric) to service_role;

commit;
