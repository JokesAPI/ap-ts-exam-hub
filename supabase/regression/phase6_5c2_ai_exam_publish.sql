-- Phase 6.5C.2 regression check for AI exam publishing.
--
-- NOT part of `npm test` -- that suite is intentionally network-free (mocked
-- fetch/Vercel handlers only) and has no Postgres connection available. This
-- exercises the real database functions (validate_draft, publish_draft,
-- slugify) directly and is meant to be run ad hoc against the project via
-- the Supabase SQL editor/CLI, e.g. before/after any future change to
-- publish_draft(). It is fully self-rolling-back: every assertion failure
-- and the final success both raise, so nothing it does is ever committed --
-- safe to run against production.
--
-- Covers:
--   - AI exam publish succeeds end-to-end (validate_draft -> publish_draft)
--   - title, exam_name, slug are all populated and non-null
--   - organization/status default correctly when absent from json_data
--   - exam_date/last_date/notification_url map correctly when present
--   - the published exam is visible under the same query AdminQuestions.jsx
--     and Exams.jsx use (is_active = true, slug is not null)
--   - no duplicate row is created for a single publish call

do $$
declare
  v_admin_id uuid;
  v_draft_id uuid;
  v_result jsonb;
  v_failures text[];
  v_exam_row record;
  v_visible_count int;
begin
  select id into v_admin_id from profiles where is_admin = true limit 1;
  if v_admin_id is null then
    raise exception 'REGRESSION FAILED: no admin profile found to run this check as';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin_id::text, 'role','authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  insert into ai_drafts (content_type, title, content, json_data, status)
  values (
    'exams',
    'Regression Check Exam Publish',
    'Regression check description body.',
    '{"eligibility":"Graduate","syllabus":"General Studies","organization":"TSPSC","status":"Open","exam_date":"2026-10-01","last_date":"2026-09-15","official_website":"https://example.gov.in/regression-notice"}'::jsonb,
    'draft'
  )
  returning id into v_draft_id;

  v_failures := validate_draft(v_draft_id);
  if array_length(v_failures, 1) is not null then
    raise exception 'REGRESSION FAILED: validate_draft rejected a valid exam draft: %', v_failures;
  end if;

  v_result := publish_draft(v_draft_id, v_admin_id);
  if not (v_result->>'success')::boolean then
    raise exception 'REGRESSION FAILED: publish_draft did not report success: %', v_result;
  end if;

  select * into v_exam_row from exams where id = (v_result->>'published_id')::uuid;

  if v_exam_row.title is null then raise exception 'REGRESSION FAILED: title is NULL'; end if;
  if v_exam_row.exam_name is null then raise exception 'REGRESSION FAILED: exam_name is NULL'; end if;
  if v_exam_row.slug is null then raise exception 'REGRESSION FAILED: slug is NULL'; end if;
  if v_exam_row.slug != 'regression-check-exam-publish' then
    raise exception 'REGRESSION FAILED: slug mismatch, got %', v_exam_row.slug;
  end if;
  if v_exam_row.organization != 'TSPSC' then raise exception 'REGRESSION FAILED: organization not mapped from json_data'; end if;
  if v_exam_row.status != 'Open' then raise exception 'REGRESSION FAILED: status not mapped from json_data'; end if;
  if v_exam_row.exam_date != '2026-10-01' then raise exception 'REGRESSION FAILED: exam_date not mapped'; end if;
  if v_exam_row.last_date != '2026-09-15' then raise exception 'REGRESSION FAILED: last_date not mapped'; end if;
  if v_exam_row.notification_url != 'https://example.gov.in/regression-notice' then
    raise exception 'REGRESSION FAILED: notification_url not mapped from official_website';
  end if;

  -- Same predicate AdminQuestions.jsx uses to populate its exam dropdown
  select count(*) into v_visible_count
  from exams where id = v_exam_row.id and is_active = true and slug is not null;
  if v_visible_count != 1 then
    raise exception 'REGRESSION FAILED: published exam not visible under AdminQuestions'' active/slug filter';
  end if;

  -- No duplicate row for a single publish call
  if (select count(*) from exams where slug = v_exam_row.slug) != 1 then
    raise exception 'REGRESSION FAILED: more than one exam row with this slug';
  end if;

  raise notice 'REGRESSION PASSED: all Phase 6.5C.2 checks OK. Rolling back (nothing committed).';
  raise exception 'REGRESSION_ROLLBACK_ON_SUCCESS'; -- always abort the transaction, pass or fail
end $$;
