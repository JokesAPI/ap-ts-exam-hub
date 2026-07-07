-- ROLLBACK for 20260707014946_phase5_automation_hardening
-- Reverses: automation tables, version history, bulk functions, health function,
-- source scoring, 'archived' status, and the phase5 rewrites of publish/reject.
-- Restores publish_draft / reject_draft to their 20260706111242 definitions.

begin;

-- 1. Drop phase5-only functions
drop function if exists public.get_automation_health();
drop function if exists public.bulk_archive_drafts(uuid[], uuid);
drop function if exists public.bulk_publish_drafts(uuid[], uuid);
drop function if exists public.bulk_reject_drafts(uuid[], uuid, text);
drop function if exists public.bulk_approve_drafts(uuid[], uuid, text);
drop function if exists public.record_source_outcome(text, text);

-- 2. Drop version-history trigger + function + table
drop trigger if exists trg_save_draft_version on ai_drafts;
drop function if exists public.save_draft_version();
drop table if exists ai_draft_versions;

-- 3. Drop automation framework tables
drop table if exists automation_dead_letter;
drop table if exists automation_runs;
drop table if exists automation_sources;

-- 4. Revert ai_drafts status constraint (remove 'archived').
--    Guard: any archived rows must be reclassified first or the constraint fails.
update ai_drafts set status = 'rejected', updated_at = now()
where status = 'archived';

alter table ai_drafts drop constraint if exists ai_drafts_status_check;
alter table ai_drafts add constraint ai_drafts_status_check
  check (status in ('draft','validated','approved','rejected','published'));

-- 5. Drop phase5 columns
alter table ai_drafts drop column if exists source_type;
alter table ai_drafts drop column if exists collected_at;

-- 6. Restore publish_draft to its 20260706111242 definition
--    (identity check retained, no record_source_outcome call)
create or replace function public.publish_draft(p_draft_id uuid, p_admin_id uuid)
 returns jsonb
 language plpgsql
 security definer
as $function$
declare
  d ai_drafts;
  is_caller_admin boolean;
  new_id uuid;
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
$function$;

-- 7. Restore reject_draft to its 20260706111242 definition
create or replace function public.reject_draft(p_draft_id uuid, p_admin_id uuid, p_reason text)
 returns void
 language plpgsql
 security definer
as $function$
begin
  if p_admin_id is distinct from auth.uid() then
    raise exception 'Not permitted: p_admin_id must match the authenticated caller.';
  end if;
  if not (select is_admin from profiles where id = p_admin_id) then
    raise exception 'Not permitted: only admins can reject drafts.';
  end if;
  update ai_drafts
  set status = 'rejected', reviewed_by = p_admin_id, reviewed_at = now(),
      review_notes = p_reason, updated_at = now()
  where id = p_draft_id;
  if not found then
    raise exception 'Draft not found.';
  end if;
  insert into ai_draft_logs (draft_id, event, actor, details)
  values (p_draft_id, 'rejected', p_admin_id::text, jsonb_build_object('reason', p_reason));
end;
$function$;

commit;
