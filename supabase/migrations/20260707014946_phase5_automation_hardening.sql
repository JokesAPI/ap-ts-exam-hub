begin;

alter table ai_drafts add column if not exists source_type text
  check (source_type in ('rss', 'website', 'pdf', 'api', 'manual'));
alter table ai_drafts add column if not exists collected_at timestamptz;

alter table ai_drafts drop constraint if exists ai_drafts_status_check;
alter table ai_drafts add constraint ai_drafts_status_check
  check (status in ('draft','validated','approved','rejected','published','archived'));

create table if not exists automation_sources (
  id                uuid primary key default gen_random_uuid(),
  name              text unique not null,
  source_type       text not null check (source_type in ('rss', 'website', 'pdf', 'api', 'manual')),
  url               text,
  confidence_score  numeric default 50,
  total_drafted     integer default 0,
  total_published   integer default 0,
  total_rejected    integer default 0,
  last_run_at       timestamptz,
  created_at        timestamptz default now()
);

alter table automation_sources enable row level security;
create policy "automation_sources_admin_all"
on automation_sources for all to authenticated
using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

create table if not exists automation_runs (
  id                    uuid primary key default gen_random_uuid(),
  source_name           text not null,
  connector_type        text not null check (connector_type in ('rss', 'website', 'pdf', 'api', 'manual')),
  started_at            timestamptz not null default now(),
  finished_at           timestamptz,
  success               boolean,
  error_message         text,
  retry_count           integer default 0,
  records_collected     integer default 0,
  records_drafted       integer default 0,
  duplicate_count       integer default 0,
  ai_processing_time_ms integer,
  created_at            timestamptz default now()
);

create index if not exists idx_automation_runs_source ON automation_runs(source_name, started_at desc);

alter table automation_runs enable row level security;
create policy "automation_runs_admin_all"
on automation_runs for all to authenticated
using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

create table if not exists automation_dead_letter (
  id                uuid primary key default gen_random_uuid(),
  source_name       text not null,
  connector_type    text not null,
  raw_item_data     jsonb not null,
  error_message     text not null,
  retry_count       integer not null,
  failed_at         timestamptz default now(),
  resolved          boolean default false,
  resolved_by       uuid references profiles(id),
  resolved_at       timestamptz
);

alter table automation_dead_letter enable row level security;
create policy "automation_dead_letter_admin_all"
on automation_dead_letter for all to authenticated
using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

create table if not exists ai_draft_versions (
  id            uuid primary key default gen_random_uuid(),
  draft_id      uuid references ai_drafts(id) on delete cascade,
  version_number integer not null,
  title         text,
  content       text,
  json_data     jsonb,
  edited_by     uuid references profiles(id),
  edited_at     timestamptz default now()
);

create index if not exists idx_ai_draft_versions_draft_id on ai_draft_versions(draft_id);

alter table ai_draft_versions enable row level security;
create policy "ai_draft_versions_admin_select"
on ai_draft_versions for select to authenticated
using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

create or replace function public.save_draft_version()
returns trigger
language plpgsql
security definer
as $$
declare
  next_version integer;
begin
  if (new.title is distinct from old.title)
     or (new.content is distinct from old.content)
     or (new.json_data is distinct from old.json_data) then
    select coalesce(max(version_number), 0) + 1 into next_version
      from ai_draft_versions where draft_id = old.id;
    insert into ai_draft_versions (draft_id, version_number, title, content, json_data, edited_by)
    values (old.id, next_version, old.title, old.content, old.json_data, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_save_draft_version on ai_drafts;
create trigger trg_save_draft_version
before update on ai_drafts
for each row execute procedure public.save_draft_version();

create or replace function public.record_source_outcome(p_source_name text, p_outcome text)
returns void
language plpgsql
security definer
as $$
begin
  if p_source_name is null then
    return;
  end if;
  insert into automation_sources (name, source_type, total_published, total_rejected)
  values (p_source_name, 'manual', 0, 0)
  on conflict (name) do nothing;

  if p_outcome = 'published' then
    update automation_sources set total_published = total_published + 1 where name = p_source_name;
  elsif p_outcome = 'rejected' then
    update automation_sources set total_rejected = total_rejected + 1 where name = p_source_name;
  end if;

  update automation_sources
  set confidence_score = round(
    100.0 * total_published / greatest(total_published + total_rejected, 1)
  )
  where name = p_source_name;
end;
$$;

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

create or replace function public.reject_draft(p_draft_id uuid, p_admin_id uuid, p_reason text)
 returns void
 language plpgsql
 security definer
as $function$
declare
  d ai_drafts;
begin
  if p_admin_id is distinct from auth.uid() then
    raise exception 'Not permitted: p_admin_id must match the authenticated caller.';
  end if;
  if not (select is_admin from profiles where id = p_admin_id) then
    raise exception 'Not permitted: only admins can reject drafts.';
  end if;
  select * into d from ai_drafts where id = p_draft_id;
  if d is null then
    raise exception 'Draft not found.';
  end if;
  update ai_drafts
  set status = 'rejected', reviewed_by = p_admin_id, reviewed_at = now(),
      review_notes = p_reason, updated_at = now()
  where id = p_draft_id;
  perform record_source_outcome(d.source_name, 'rejected');
  insert into ai_draft_logs (draft_id, event, actor, details)
  values (p_draft_id, 'rejected', p_admin_id::text, jsonb_build_object('reason', p_reason));
end;
$function$;

create or replace function public.bulk_approve_drafts(p_draft_ids uuid[], p_admin_id uuid, p_notes text default null)
returns int
language plpgsql
security definer
as $$
declare
  affected int;
begin
  if p_admin_id is distinct from auth.uid() then
    raise exception 'Not permitted: p_admin_id must match the authenticated caller.';
  end if;
  if not coalesce((select is_admin from profiles where id = p_admin_id), false) then
    raise exception 'Not permitted: only admins can approve drafts.';
  end if;
  update ai_drafts
  set status='approved', reviewed_by=p_admin_id, reviewed_at=now(),
      review_notes=coalesce(p_notes, review_notes), updated_at=now()
  where id = any(p_draft_ids) and status = 'validated';
  get diagnostics affected = row_count;
  insert into ai_draft_logs (draft_id, event, actor, details)
  select unnest(p_draft_ids), 'approved', p_admin_id::text, jsonb_build_object('bulk', true, 'notes', p_notes);
  return affected;
end;
$$;

create or replace function public.bulk_reject_drafts(p_draft_ids uuid[], p_admin_id uuid, p_reason text)
returns int
language plpgsql
security definer
as $$
declare
  affected int;
begin
  if p_admin_id is distinct from auth.uid() then
    raise exception 'Not permitted: p_admin_id must match the authenticated caller.';
  end if;
  if not coalesce((select is_admin from profiles where id = p_admin_id), false) then
    raise exception 'Not permitted: only admins can reject drafts.';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'Bulk rejection requires a reason.';
  end if;
  update ai_drafts
  set status='rejected', reviewed_by=p_admin_id, reviewed_at=now(), review_notes=p_reason, updated_at=now()
  where id = any(p_draft_ids);
  get diagnostics affected = row_count;
  insert into ai_draft_logs (draft_id, event, actor, details)
  select unnest(p_draft_ids), 'rejected', p_admin_id::text, jsonb_build_object('bulk', true, 'reason', p_reason);
  return affected;
end;
$$;

create or replace function public.bulk_publish_drafts(p_draft_ids uuid[], p_admin_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  d_id uuid;
  result jsonb := '[]'::jsonb;
  one_result jsonb;
begin
  if p_admin_id is distinct from auth.uid() then
    raise exception 'Not permitted: p_admin_id must match the authenticated caller.';
  end if;
  foreach d_id in array p_draft_ids loop
    begin
      one_result := publish_draft(d_id, p_admin_id);
      result := result || jsonb_build_object('draft_id', d_id, 'result', one_result);
    exception when others then
      result := result || jsonb_build_object('draft_id', d_id, 'error', sqlerrm);
    end;
  end loop;
  return result;
end;
$$;

create or replace function public.bulk_archive_drafts(p_draft_ids uuid[], p_admin_id uuid)
returns int
language plpgsql
security definer
as $$
declare
  affected int;
begin
  if p_admin_id is distinct from auth.uid() then
    raise exception 'Not permitted: p_admin_id must match the authenticated caller.';
  end if;
  if not coalesce((select is_admin from profiles where id = p_admin_id), false) then
    raise exception 'Not permitted: only admins can archive drafts.';
  end if;
  update ai_drafts set status='archived', updated_at=now()
  where id = any(p_draft_ids) and status in ('rejected', 'published');
  get diagnostics affected = row_count;
  insert into ai_draft_logs (draft_id, event, actor, details)
  select unnest(p_draft_ids), 'archived', p_admin_id::text, jsonb_build_object('bulk', true);
  return affected;
end;
$$;

grant execute on function bulk_approve_drafts(uuid[], uuid, text) to authenticated;
grant execute on function bulk_reject_drafts(uuid[], uuid, text) to authenticated;
grant execute on function bulk_publish_drafts(uuid[], uuid) to authenticated;
grant execute on function bulk_archive_drafts(uuid[], uuid) to authenticated;
grant execute on function record_source_outcome(text, text) to authenticated, service_role;

create or replace function public.get_automation_health()
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin = true) then
    raise exception 'Not permitted: admin only';
  end if;

  select jsonb_build_object(
    'sources', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', s.name,
        'source_type', s.source_type,
        'confidence_score', s.confidence_score,
        'total_drafted', s.total_drafted,
        'total_published', s.total_published,
        'total_rejected', s.total_rejected,
        'last_run_at', s.last_run_at
      )), '[]'::jsonb)
      from automation_sources s
    ),
    'last_run', (
      select jsonb_build_object(
        'source_name', r.source_name, 'started_at', r.started_at,
        'finished_at', r.finished_at, 'success', r.success
      )
      from automation_runs r order by r.started_at desc limit 1
    ),
    'last_success', (
      select jsonb_build_object('source_name', r.source_name, 'finished_at', r.finished_at)
      from automation_runs r where r.success = true order by r.finished_at desc limit 1
    ),
    'last_failure', (
      select jsonb_build_object('source_name', r.source_name, 'finished_at', r.finished_at, 'error_message', r.error_message)
      from automation_runs r where r.success = false order by r.finished_at desc limit 1
    ),
    'total_processed', (select coalesce(sum(records_collected), 0) from automation_runs),
    'total_duplicates', (select coalesce(sum(duplicate_count), 0) from automation_runs),
    'pending_drafts', (select count(*) from ai_drafts where status in ('draft', 'validated')),
    'published_today', (select count(*) from ai_drafts where status = 'published' and published_at::date = current_date),
    'dead_letter_unresolved', (select count(*) from automation_dead_letter where resolved = false)
  ) into result;

  return result;
end;
$$;

grant execute on function get_automation_health() to authenticated;

commit;