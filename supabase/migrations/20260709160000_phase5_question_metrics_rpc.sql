-- ============================================================================
-- 20260709160000_phase5_question_metrics_rpc
--
-- Admin dashboards: real question/AI metrics via a single admin-gated RPC
-- (avoids many client round-trips). Additive only — no schema/table changes.
--
-- Also hardens get_automation_health: it is internally admin-gated but anon
-- held EXECUTE. Revoke anon execute on both functions (defense in depth).
-- ============================================================================

begin;

create or replace function public.get_question_metrics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  result jsonb;
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin = true) then
    raise exception 'Not permitted: admin only';
  end if;

  select jsonb_build_object(
    'total_questions',   (select count(*) from mock_questions),
    'published',         (select count(*) from mock_questions where status = 'published'),
    'draft',             (select count(*) from mock_questions where status = 'draft'),
    'in_review',         (select count(*) from mock_questions where status = 'in_review'),
    'ai_generated',      (select count(*) from mock_questions where ai_generated),
    'human_verified',    (select count(*) from mock_questions where human_verified),
    'question_drafts_pending',
        (select count(*) from ai_drafts where content_type = 'questions' and status in ('draft','validated','approved')),
    'question_drafts_published_today',
        (select count(*) from ai_drafts where content_type = 'questions' and status = 'published' and published_at::date = current_date),
    'by_exam', (
      select coalesce(jsonb_agg(jsonb_build_object('exam', t.title, 'count', t.c) order by t.c desc), '[]'::jsonb)
      from (
        select coalesce(e.title, 'Unassigned') as title, count(*) as c
        from mock_questions mq left join exams e on e.id = mq.exam_id
        group by coalesce(e.title, 'Unassigned')
      ) t
    ),
    'by_subject', (
      select coalesce(jsonb_agg(jsonb_build_object('subject', t.subject, 'count', t.c) order by t.c desc), '[]'::jsonb)
      from (
        select coalesce(subject, 'Unassigned') as subject, count(*) as c
        from mock_questions group by coalesce(subject, 'Unassigned')
      ) t
    ),
    'by_difficulty', (
      select coalesce(jsonb_object_agg(coalesce(difficulty, 'unset'), c), '{}'::jsonb)
      from (select difficulty, count(*) c from mock_questions group by difficulty) t
    ),
    'recent_ai_activity', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'event', l.event, 'actor', l.actor, 'created_at', l.created_at
      ) order by l.created_at desc), '[]'::jsonb)
      from (select event, actor, created_at from ai_draft_logs order by created_at desc limit 10) l
    )
  ) into result;

  return result;
end;
$function$;

revoke all on function public.get_question_metrics() from public, anon;
grant execute on function public.get_question_metrics() to authenticated, service_role;

-- Defense in depth: get_automation_health is admin-gated internally; anon
-- inherits EXECUTE via PUBLIC, so revoke from PUBLIC and re-grant to the roles
-- that actually need it.
revoke execute on function public.get_automation_health() from public;
grant execute on function public.get_automation_health() to authenticated, service_role;

commit;
