-- ROLLBACK for 20260721140000_phase6_5c2_ai_exam_publish_columns
-- Metadata-only. Instant, no table rewrite, no data loss.
--
-- Restores publish_draft()'s 'exams' branch to its pre-6.5C.2 form (only
-- exam_name/eligibility/age_limit/syllabus/selection_process/
-- official_website populated) and drops the slugify() helper.
--
-- Any exam rows already published under the new logic before this rollback
-- runs are NOT touched or reverted -- their title/slug/organization/status/
-- description/exam_date/last_date/notification_url values remain exactly as
-- published. This only changes what future publishes will do.

create or replace function public.publish_draft(p_draft_id uuid, p_admin_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  d ai_drafts;
  is_caller_admin boolean;
  new_id uuid;
  j jsonb;
  v_exam_id uuid;
  v_test_id text;
begin
  if p_admin_id is distinct from auth.uid() then
    raise exception 'Not permitted: p_admin_id must match the authenticated caller.';
  end if;
  select is_admin into is_caller_admin from profiles where id = p_admin_id;
  if not coalesce(is_caller_admin, false) then
    raise exception 'Not permitted: only admins can publish drafts.';
  end if;

  select * into d from ai_drafts where id = p_draft_id;
  if d is null then
    raise exception 'Draft not found.';
  end if;

  if d.status not in ('validated', 'approved') then
    raise exception 'Draft must be validated or approved before publishing (current status: %).', d.status;
  end if;

  if d.content_type = 'current_affairs' then
    insert into current_affairs (title, content, category, published_date)
    values (d.title, d.content, d.json_data->>'category', coalesce((d.json_data->>'published_date')::date, current_date))
    returning id into new_id;
  elsif d.content_type = 'notifications' then
    insert into notifications (title, description, category, important_date, apply_link)
    values (d.title, d.content, coalesce(d.json_data->>'category', 'Other'),
            (d.json_data->>'important_date')::date, d.json_data->>'apply_link')
    returning id into new_id;
  elsif d.content_type = 'exams' then
    insert into exams (exam_name, eligibility, age_limit, syllabus, selection_process, official_website)
    values (d.title, d.json_data->>'eligibility', d.json_data->>'age_limit',
            d.json_data->>'syllabus', d.json_data->>'selection_process', d.json_data->>'official_website')
    returning id into new_id;
  elsif d.content_type = 'previous_papers' then
    insert into previous_papers (title, exam_category, pdf_url)
    values (d.title, coalesce(d.json_data->>'exam_category', 'Other'), d.json_data->>'pdf_url')
    returning id into new_id;
  elsif d.content_type = 'questions' then
    j := d.json_data;
    if j->>'exam_slug' is not null then
      select id into v_exam_id from exams where slug = j->>'exam_slug';
    end if;

    v_test_id := nullif(trim(coalesce(j->>'test_id','')), '');
    if v_test_id is null then
      raise exception 'Cannot publish question draft %: json_data.test_id is required and must match an existing Mock Test.', p_draft_id;
    end if;
    if not exists (select 1 from mock_tests mt where mt.test_id = v_test_id) then
      raise exception 'Cannot publish question draft %: test_id "%" does not match any existing Mock Test.', p_draft_id, v_test_id;
    end if;

    insert into mock_questions (
      test_id, exam_id, question, option_a, option_b, option_c, option_d,
      correct_answer, explanation, subject, topic, subtopic, difficulty,
      language, source, source_year, tags, status,
      created_by, reviewed_by, ai_generated, human_verified, published_at, metadata
    ) values (
      v_test_id,
      v_exam_id, j->>'question',
      j->>'option_a', j->>'option_b', j->>'option_c', j->>'option_d',
      upper(j->>'correct_answer'), j->>'explanation', nullif(j->>'subject',''),
      nullif(j->>'topic',''), nullif(j->>'subtopic',''),
      nullif(j->>'difficulty',''), coalesce(nullif(j->>'language',''),'en'),
      nullif(j->>'source',''),
      case when j->>'source_year' ~ '^\d+$' then (j->>'source_year')::int else null end,
      coalesce((select array_agg(value) from jsonb_array_elements_text(coalesce(j->'tags','[]'::jsonb))), '{}'),
      'published',
      p_admin_id, p_admin_id, true, true, now(),
      coalesce(d.json_data->'metadata', '{}'::jsonb)
    )
    returning id into new_id;
  else
    raise exception 'Unknown content_type: %', d.content_type;
  end if;

  update ai_drafts
  set status = 'published', published_at = now(), reviewed_by = p_admin_id, reviewed_at = now(), updated_at = now()
  where id = p_draft_id;

  perform record_source_outcome(d.source_name, 'published');

  insert into ai_draft_logs (draft_id, event, actor, details)
  values (p_draft_id, 'published', p_admin_id::text, jsonb_build_object('published_row_id', new_id, 'target_table', d.content_type));

  return jsonb_build_object('success', true, 'published_id', new_id, 'target_table', d.content_type);
exception when others then
  insert into ai_draft_logs (draft_id, event, actor, details)
  values (p_draft_id, 'publish_failed', p_admin_id::text, jsonb_build_object('error', sqlerrm));
  raise;
end;
$function$;

drop function if exists public.slugify(text);
