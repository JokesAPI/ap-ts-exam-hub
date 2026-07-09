-- ============================================================================
-- 20260709140000_phase4_publish_validate_questions
--
-- Phase 4 — close the questions gap in the AI draft pipeline.
--
-- Phase 3 allowed ai_drafts.content_type='questions', but the two workflow
-- functions did not handle it:
--   * validate_draft() had no questions branch → questions couldn't be
--     validated (blocking approve/publish, which require 'validated').
--   * publish_draft() raised 'Unknown content_type' for questions.
--
-- This migration extends BOTH functions additively (create or replace) with a
-- questions branch. No signatures change; all existing content-type behaviour
-- is preserved byte-for-byte. Publishing a questions draft inserts one row
-- into mock_questions as an admin-authored, published, human-verified question
-- (ai_generated=true), reusing the exact columns Phase 3 added.
--
-- A questions draft stores the question payload in json_data:
--   { question, option_a..d, correct_answer(A-D), explanation, subject,
--     topic, subtopic, difficulty(easy|medium|hard), tags[], source,
--     source_year, language, exam_slug, test_id }
-- title holds a short human-readable label for the review queue.
-- ============================================================================

begin;

-- ── validate_draft: add questions branch ────────────────────────────────────
create or replace function public.validate_draft(p_draft_id uuid)
returns text[]
language plpgsql
security definer
set search_path = public
as $function$
declare
  d ai_drafts;
  failures text[] := '{}';
  url_regex text := '^https?://[^\s]+$';
  j jsonb;
  ans text;
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
    -- question stem
    if j->>'question' is null or length(trim(j->>'question')) < 10 then
      failures := array_append(failures, 'question_too_short_or_missing');
    end if;
    -- all four options present
    if coalesce(trim(j->>'option_a'),'') = '' or coalesce(trim(j->>'option_b'),'') = ''
       or coalesce(trim(j->>'option_c'),'') = '' or coalesce(trim(j->>'option_d'),'') = '' then
      failures := array_append(failures, 'missing_options');
    end if;
    -- valid answer letter
    ans := upper(coalesce(j->>'correct_answer',''));
    if ans not in ('A','B','C','D') then
      failures := array_append(failures, 'invalid_correct_answer');
    end if;
    -- explanation required (Phase 4 rule: reject missing explanations)
    if j->>'explanation' is null or length(trim(j->>'explanation')) < 10 then
      failures := array_append(failures, 'missing_explanation');
    end if;
    -- difficulty must be valid if provided
    if (j->>'difficulty') is not null and (j->>'difficulty') not in ('easy','medium','hard') then
      failures := array_append(failures, 'invalid_difficulty');
    end if;
    -- reject exact duplicate of an existing published question (same stem)
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
$function$;

-- ── publish_draft: add questions branch ─────────────────────────────────────
create or replace function public.publish_draft(p_draft_id uuid, p_admin_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  d ai_drafts;
  is_caller_admin boolean;
  new_id uuid;
  j jsonb;
  v_exam_id uuid;
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
    -- resolve exam_id: explicit exam_slug wins, else leave null (topic pool)
    if j->>'exam_slug' is not null then
      select id into v_exam_id from exams where slug = j->>'exam_slug';
    end if;
    insert into mock_questions (
      test_id, exam_id, question, option_a, option_b, option_c, option_d,
      correct_answer, explanation, subject, topic, subtopic, difficulty,
      language, source, source_year, tags, status,
      created_by, reviewed_by, ai_generated, human_verified, published_at, metadata
    ) values (
      -- test_id is NOT NULL (engine grouping key): prefer explicit test_id,
      -- then exam_slug, else a safe 'general' bucket.
      coalesce(nullif(j->>'test_id',''), nullif(j->>'exam_slug',''), 'general'),
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

commit;
