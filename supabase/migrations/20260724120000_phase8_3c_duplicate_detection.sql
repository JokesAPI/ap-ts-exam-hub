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
