create index if not exists idx_mock_questions_question_trgm
  on public.mock_questions
  using gin (lower(question) public.gin_trgm_ops);

create or replace function public.find_near_duplicate_questions(
  p_test_id text,
  p_questions text[],
  p_threshold real default 0.45
)
returns table (
  input_question text,
  matched_id uuid,
  matched_question text,
  matched_status text,
  similarity real
)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  perform set_limit(p_threshold);

  return query
    select
      q.input_question,
      mq.id as matched_id,
      mq.question as matched_question,
      mq.status as matched_status,
      similarity(lower(mq.question), lower(q.input_question)) as similarity
    from unnest(p_questions) as q(input_question)
    join public.mock_questions mq
      on mq.test_id = p_test_id
     and lower(mq.question) % lower(q.input_question)
    order by similarity desc;
end;
$$;

comment on function public.find_near_duplicate_questions is
  'Phase 8.3C Tier B (near-duplicate) support, revised in Phase 8.3E to use the indexable pg_trgm % operator. Read-only, SECURITY INVOKER (respects the calling session existing RLS). Never blocks writes by itself; callers treat its results as a non-blocking review signal only.';

-- Phase 8.3 Step 6C: explicit EXECUTE permission management.
--
-- By default, Supabase grants EXECUTE on a newly created function in the
-- public schema to PUBLIC (and therefore transitively to anon and
-- authenticated) -- confirmed live via pg_default_acl on both production
-- and the staging candidate during the Step 6B audit. SECURITY INVOKER
-- plus RLS already prevents a non-admin caller from ever seeing draft or
-- unpublished question text through this RPC (their own RLS policy
-- filters the join to status='published' regardless of who calls it), so
-- this was already safe as written. This is defense in depth on top of
-- that, not a fix to a data leak: there is simply no reason for an
-- anonymous or public caller to be able to invoke an admin-facing
-- duplicate-check RPC at all, even though they could never extract
-- anything sensitive through it.
--
-- SECURITY INVOKER and RLS remain the actual data-visibility controls --
-- these grants only narrow who can call the function, not what it's
-- allowed to see once called.
revoke execute on function public.find_near_duplicate_questions(
  text,
  text[],
  real
) from public;

revoke execute on function public.find_near_duplicate_questions(
  text,
  text[],
  real
) from anon;

grant execute on function public.find_near_duplicate_questions(
  text,
  text[],
  real
) to authenticated;

grant execute on function public.find_near_duplicate_questions(
  text,
  text[],
  real
) to service_role;
