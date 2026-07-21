-- ============================================================================
-- Phase 6.5C.2 — AI exam publishing root-cause fix
--
-- Root cause: publish_draft()'s `exams` branch has only ever inserted
--   (exam_name, eligibility, age_limit, syllabus, selection_process,
--    official_website)
-- leaving title, slug, organization, status, description, exam_date,
-- last_date, and notification_url NULL on every AI-published exam. Phase
-- 6.5C.1 made the frontend resilient to a NULL title (Exams.jsx / Home.jsx
-- fall back to exam_name) and fixed the *admin* create path to populate
-- exam_name/slug -- but the AI publish path itself was left untouched, per
-- that phase's approved scope. This migration is the deferred fix.
--
-- Evidence gathered before writing this:
--   - ai_drafts currently holds 0 rows with content_type = 'exams' -- zero
--     production rows are affected by this change.
--   - validate_draft()'s 'exams' branch only requires eligibility and/or
--     syllabus in json_data, and validates official_website as a URL if
--     present. It has no knowledge of organization/status/exam_date/
--     last_date/notification_url -- so those are optional, free-form keys
--     in json_data today, not a fixed contract. Fields are read with
--     coalesce()/nullif() defaults rather than required, matching this.
--   - No slug-generation function exists anywhere in the database
--     (checked pg_proc for '%slug%' -- only exams_protect_slug, a BEFORE
--     UPDATE trigger guarding against slug changes, unaffected by this
--     INSERT-only change). One is added here, used by this one call site.
--   - exams.notification_url and exams.official_website are two columns
--     covering the same concept (a link to the official notice); the admin
--     create form only ever set notification_url. AI-published exams now
--     get both set from the same value so the "Official Notification" link
--     in Exams.jsx works identically for AI-published and admin-created
--     exams. No new json_data key introduced.
--   - bulk_publish_drafts() only delegates to publish_draft() in a loop; it
--     has no insert logic of its own, so it needs no change.
--
-- Change: exactly one branch of publish_draft() (content_type = 'exams').
-- Every other branch (current_affairs, notifications, previous_papers,
-- questions) is byte-identical to the version committed in
-- 20260721045809_phase6_5a3_pre_require_valid_test_id_on_question_drafts.sql.
--
-- Not in scope, left for a future phase if it becomes necessary: enforcing
-- slug uniqueness. exams.slug has no unique constraint today (verified via
-- pg_constraint), so two AI drafts with the same title would produce two
-- rows with the same slug. This is a pre-existing property of the slug
-- column, not introduced by this migration, and out of this phase's
-- approved scope.
-- ============================================================================

-- ── Helper: single slug generator, reusable by any future server-side writer ──
create or replace function public.slugify(p_text text)
returns text
language sql
immutable
as $fn$
  select nullif(
    trim(both '-' from regexp_replace(lower(trim(coalesce(p_text, ''))), '[^a-z0-9]+', '-', 'g')),
    ''
  )
$fn$;

comment on function public.slugify(text) is
  'Deterministic slug generator (lowercase, non-alphanumeric runs -> single hyphen, trimmed). Mirrors the client-side logic in AdminExams.jsx; used server-side by publish_draft() for AI-published exams.';

-- ── publish_draft(): exams branch now populates the full column set ──────────
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
    -- Phase 6.5C.2: full column set, not just exam_name. title/slug/
    -- organization/status/description/exam_date/last_date/notification_url
    -- were previously left NULL on every AI-published exam.
    insert into exams (
      exam_name, title, slug, organization, status, description,
      exam_date, last_date, notification_url,
      eligibility, age_limit, syllabus, selection_process, official_website
    )
    values (
      d.title,
      d.title,
      slugify(d.title),
      coalesce(d.json_data->>'organization', 'Other'),
      coalesce(d.json_data->>'status', 'Upcoming'),
      d.content,
      nullif(d.json_data->>'exam_date', '')::date,
      nullif(d.json_data->>'last_date', '')::date,
      d.json_data->>'official_website',
      d.json_data->>'eligibility', d.json_data->>'age_limit',
      d.json_data->>'syllabus', d.json_data->>'selection_process',
      d.json_data->>'official_website'
    )
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
$function$;
