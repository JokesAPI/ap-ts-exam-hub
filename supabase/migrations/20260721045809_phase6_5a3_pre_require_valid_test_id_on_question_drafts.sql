-- ============================================================================
-- Phase 6.5A.3-pre — prerequisite fixes for the mock_questions.test_id FK
--
-- Root cause: validate_draft() never checked test_id for question drafts, so a
-- draft omitting it reached 'validated' legitimately; publish_draft() then
-- substituted 'general' or the exam_slug, neither of which exists in
-- mock_tests. Verified: 0 of 29 exam slugs match any test_id.
--
-- Fix 1 (validate_draft): question drafts must carry a test_id that resolves to
--   a real mock test. Failure is reported at validation time with a named
--   reason in review_notes, consistent with every other check in the function.
-- Fix 2 (publish_draft): the fallback chain is removed. Publishing a question
--   uses only a resolved test_id and otherwise fails with a descriptive error.
--
-- The exam_slug -> v_exam_id lookup is retained: resolving exam_id from a slug
-- is legitimate. Only its misuse as a test_id substitute is removed.
-- No other content_type branch is altered.
-- ============================================================================

create or replace function public.validate_draft(p_draft_id uuid)
 returns text[]
 language plpgsql
 security definer
 set search_path to 'public'
as $fn$
declare
  d ai_drafts;
  failures text[] := '{}';
  url_regex text := '^https?://[^\s]+$';
  j jsonb;
  ans text;
  v_test_id text;
begin
  select * into d from ai_drafts where id = p_draft_id;
  if d is null then
    return array['draft_not_found'];
  end if;

  if d.title is null or length(trim(d.title)) < 5 then
    failures := array_append(failures, 'title_too_short_or_missing');
  end if;

  if d.source_url is not null and d.source_url !~* url_regex then
    failures := array_append(failures, 'invalid_source_url');
  end if;

  if d.content_type = 'current_affairs' then
    if d.content is null or length(trim(d.content)) < 50 then
      failures := array_append(failures, 'content_too_short');
    end if;
    if (d.json_data->>'published_date') is not null then
      begin
        perform (d.json_data->>'published_date')::date;
      exception when others then
        failures := array_append(failures, 'invalid_published_date');
      end;
    end if;

  elsif d.content_type = 'notifications' then
    if d.json_data->>'category' is null
       or d.json_data->>'category' not in ('APPSC','TSPSC','DSC','Police','Group','Other') then
      failures := array_append(failures, 'missing_or_invalid_category');
    end if;
    if (d.json_data->>'apply_link') is not null
       and (d.json_data->>'apply_link') !~* url_regex then
      failures := array_append(failures, 'invalid_apply_link');
    end if;

  elsif d.content_type = 'exams' then
    if d.json_data->>'eligibility' is null and d.json_data->>'syllabus' is null then
      failures := array_append(failures, 'missing_eligibility_and_syllabus');
    end if;
    if (d.json_data->>'official_website') is not null
       and (d.json_data->>'official_website') !~* url_regex then
      failures := array_append(failures, 'invalid_official_website');
    end if;

  elsif d.content_type = 'previous_papers' then
    if d.json_data->>'exam_category' is null then
      failures := array_append(failures, 'missing_exam_category');
    end if;
    if d.json_data->>'pdf_url' is null or (d.json_data->>'pdf_url') !~* url_regex then
      failures := array_append(failures, 'missing_or_invalid_pdf_url');
    end if;

  elsif d.content_type = 'questions' then
    j := d.json_data;

    -- Phase 6.5A.3-pre: a question must belong to a real mock test. Checked
    -- here so the draft fails validation with a named reason rather than
    -- failing later inside publish_draft().
    v_test_id := nullif(trim(coalesce(j->>'test_id','')), '');
    if v_test_id is null then
      failures := array_append(failures, 'missing_test_id');
    elsif not exists (select 1 from mock_tests mt where mt.test_id = v_test_id) then
      failures := array_append(failures, 'unknown_test_id (' || v_test_id || ') — must match an existing Mock Test');
    end if;

    if j->>'question' is null or length(trim(j->>'question')) < 10 then
      failures := array_append(failures, 'question_too_short_or_missing');
    end if;
    if coalesce(trim(j->>'option_a'),'') = '' or coalesce(trim(j->>'option_b'),'') = ''
       or coalesce(trim(j->>'option_c'),'') = '' or coalesce(trim(j->>'option_d'),'') = '' then
      failures := array_append(failures, 'missing_options');
    end if;
    ans := upper(coalesce(j->>'correct_answer',''));
    if ans not in ('A','B','C','D') then
      failures := array_append(failures, 'invalid_correct_answer');
    end if;
    if j->>'explanation' is null or length(trim(j->>'explanation')) < 10 then
      failures := array_append(failures, 'missing_explanation');
    end if;
    if (j->>'difficulty') is not null and (j->>'difficulty') not in ('easy','medium','hard') then
      failures := array_append(failures, 'invalid_difficulty');
    end if;
    if exists (
      select 1 from mock_questions mq
      where mq.status = 'published'
        and lower(trim(mq.question)) = lower(trim(coalesce(j->>'question','')))
    ) then
      failures := array_append(failures, 'duplicate_question_exists');
    end if;
  end if;

  if array_length(failures, 1) is null then
    update ai_drafts set status = 'validated', review_notes = null, updated_at = now() where id = p_draft_id;
  else
    update ai_drafts set review_notes = array_to_string(failures, ', '), updated_at = now() where id = p_draft_id;
  end if;

  insert into ai_draft_logs (draft_id, event, actor, details)
  values (p_draft_id, case when array_length(failures,1) is null then 'validated' else 'validation_failed' end,
          'system', jsonb_build_object('failures', failures));

  return failures;

exception when others then
  failures := array_append(failures, 'validation_error: ' || sqlerrm);
  return failures;
end;
$fn$;


create or replace function public.publish_draft(p_draft_id uuid, p_admin_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $fn$
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

    -- Phase 6.5A.3-pre: no fallback chain. A question is published only under a
    -- test_id that resolves to a real mock test. Previously this coalesced to
    -- the exam_slug, then to the literal 'general' -- neither of which exists
    -- in mock_tests, so both produced orphaned questions.
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
$fn$;
