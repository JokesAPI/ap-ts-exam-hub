begin;

create extension if not exists pg_trgm;

create table if not exists ai_drafts (
  id               uuid primary key default gen_random_uuid(),
  content_type     text not null check (content_type in ('current_affairs', 'notifications', 'exams', 'previous_papers')),
  title            text not null,
  content          text,
  json_data        jsonb default '{}'::jsonb,
  language         text default 'en',
  source_url       text,
  source_name      text,
  source_hash      text,
  ai_model         text,
  confidence_score numeric(3,2) check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)),
  status           text not null default 'draft' check (status in ('draft', 'validated', 'approved', 'rejected', 'published')),
  review_notes     text,
  reviewed_by      uuid references profiles(id),
  reviewed_at      timestamptz,
  published_at     timestamptz,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index if not exists idx_ai_drafts_status       on ai_drafts(status);
create index if not exists idx_ai_drafts_content_type on ai_drafts(content_type);
create index if not exists idx_ai_drafts_source_hash  on ai_drafts(source_hash);
create index if not exists idx_ai_drafts_created_at   on ai_drafts(created_at desc);
create index if not exists idx_ai_drafts_title_trgm   on ai_drafts using gin (title gin_trgm_ops);

alter table ai_drafts enable row level security;

drop policy if exists "ai_drafts_admin_all" on ai_drafts;
create policy "ai_drafts_admin_all"
on ai_drafts for all
to authenticated
using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

create table if not exists ai_draft_logs (
  id           uuid primary key default gen_random_uuid(),
  draft_id     uuid references ai_drafts(id) on delete cascade,
  event        text not null check (event in (
                 'scraped', 'ai_generated', 'duplicate_detected', 'validated',
                 'validation_failed', 'approved', 'rejected', 'published',
                 'publish_failed', 'retry'
               )),
  actor        text not null default 'system',
  details      jsonb default '{}'::jsonb,
  created_at   timestamptz default now()
);

create index if not exists idx_ai_draft_logs_draft_id on ai_draft_logs(draft_id);
create index if not exists idx_ai_draft_logs_event    on ai_draft_logs(event);

alter table ai_draft_logs enable row level security;

drop policy if exists "ai_draft_logs_admin_all" on ai_draft_logs;
create policy "ai_draft_logs_admin_all"
on ai_draft_logs for all
to authenticated
using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

create or replace function public.check_duplicate_draft(
  p_content_type text,
  p_title text,
  p_source_url text,
  p_source_hash text
)
returns table (
  match_source text,
  match_id uuid,
  match_title text,
  match_reason text,
  similarity_score real
)
language plpgsql
security definer
as $$
begin
  if p_source_hash is not null then
    return query
      select 'ai_drafts'::text, d.id, d.title, 'exact_source_hash'::text, 1.0::real
      from ai_drafts d
      where d.source_hash = p_source_hash and d.content_type = p_content_type
      limit 5;
  end if;

  if p_source_url is not null then
    return query
      select 'ai_drafts'::text, d.id, d.title, 'exact_source_url'::text, 1.0::real
      from ai_drafts d
      where d.source_url = p_source_url and d.content_type = p_content_type
      limit 5;
  end if;

  return query
    select 'ai_drafts'::text, d.id, d.title, 'similar_title'::text, similarity(d.title, p_title)
    from ai_drafts d
    where d.content_type = p_content_type
      and similarity(d.title, p_title) > 0.6
    order by similarity(d.title, p_title) desc
    limit 5;

  if p_content_type = 'current_affairs' then
    return query
      select 'current_affairs'::text, c.id, c.title, 'similar_title_published'::text, similarity(c.title, p_title)
      from current_affairs c where similarity(c.title, p_title) > 0.6
      order by similarity(c.title, p_title) desc limit 5;
  elsif p_content_type = 'notifications' then
    return query
      select 'notifications'::text, n.id, n.title, 'similar_title_published'::text, similarity(n.title, p_title)
      from notifications n where similarity(n.title, p_title) > 0.6
      order by similarity(n.title, p_title) desc limit 5;
  elsif p_content_type = 'exams' then
    return query
      select 'exams'::text, e.id, e.exam_name, 'similar_title_published'::text, similarity(e.exam_name, p_title)
      from exams e where similarity(e.exam_name, p_title) > 0.6
      order by similarity(e.exam_name, p_title) desc limit 5;
  elsif p_content_type = 'previous_papers' then
    return query
      select 'previous_papers'::text, pp.id, pp.title, 'similar_title_published'::text, similarity(pp.title, p_title)
      from previous_papers pp where similarity(pp.title, p_title) > 0.6
      order by similarity(pp.title, p_title) desc limit 5;
  end if;
end;
$$;

create or replace function public.validate_draft(p_draft_id uuid)
returns text[]
language plpgsql
security definer
as $$
declare
  d ai_drafts;
  failures text[] := '{}';
  url_regex text := '^https?://[^\s]+$';
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
$$;

commit;