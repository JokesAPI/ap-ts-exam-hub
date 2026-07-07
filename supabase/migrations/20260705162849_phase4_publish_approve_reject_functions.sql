create or replace function public.publish_draft(p_draft_id uuid, p_admin_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  d ai_drafts;
  is_caller_admin boolean;
  new_id uuid;
begin
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

  else
    raise exception 'Unknown content_type: %', d.content_type;
  end if;

  update ai_drafts
  set status = 'published', published_at = now(), reviewed_by = p_admin_id, reviewed_at = now(), updated_at = now()
  where id = p_draft_id;

  insert into ai_draft_logs (draft_id, event, actor, details)
  values (p_draft_id, 'published', p_admin_id::text, jsonb_build_object('published_row_id', new_id, 'target_table', d.content_type));

  return jsonb_build_object('success', true, 'published_id', new_id, 'target_table', d.content_type);

exception when others then
  insert into ai_draft_logs (draft_id, event, actor, details)
  values (p_draft_id, 'publish_failed', p_admin_id::text, jsonb_build_object('error', sqlerrm));
  raise;
end;
$$;

create or replace function public.approve_draft(p_draft_id uuid, p_admin_id uuid, p_notes text default null)
returns void
language plpgsql
security definer
as $$
begin
  if not (select is_admin from profiles where id = p_admin_id) then
    raise exception 'Not permitted: only admins can approve drafts.';
  end if;
  update ai_drafts
  set status = 'approved', reviewed_by = p_admin_id, reviewed_at = now(),
      review_notes = coalesce(p_notes, review_notes), updated_at = now()
  where id = p_draft_id;
  insert into ai_draft_logs (draft_id, event, actor, details)
  values (p_draft_id, 'approved', p_admin_id::text, jsonb_build_object('notes', p_notes));
end;
$$;

create or replace function public.reject_draft(p_draft_id uuid, p_admin_id uuid, p_reason text)
returns void
language plpgsql
security definer
as $$
begin
  if not (select is_admin from profiles where id = p_admin_id) then
    raise exception 'Not permitted: only admins can reject drafts.';
  end if;
  update ai_drafts
  set status = 'rejected', reviewed_by = p_admin_id, reviewed_at = now(),
      review_notes = p_reason, updated_at = now()
  where id = p_draft_id;
  insert into ai_draft_logs (draft_id, event, actor, details)
  values (p_draft_id, 'rejected', p_admin_id::text, jsonb_build_object('reason', p_reason));
end;
$$;