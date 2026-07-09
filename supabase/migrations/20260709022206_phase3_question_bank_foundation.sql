begin;

alter table public.mock_questions
  add column if not exists exam_id        uuid references public.exams(id) on delete set null,
  add column if not exists topic          text,
  add column if not exists subtopic       text,
  add column if not exists language       text not null default 'en',
  add column if not exists source         text,
  add column if not exists source_year    integer,
  add column if not exists tags           text[] not null default '{}',
  add column if not exists status         text not null default 'published',
  add column if not exists created_by     uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_by    uuid references public.profiles(id) on delete set null,
  add column if not exists ai_generated   boolean not null default false,
  add column if not exists human_verified boolean not null default true,
  add column if not exists published_at   timestamptz,
  add column if not exists updated_at     timestamptz not null default now(),
  add column if not exists metadata       jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='mock_questions_status_check' and conrelid='public.mock_questions'::regclass) then
    alter table public.mock_questions add constraint mock_questions_status_check
      check (status in ('draft','in_review','approved','published','rejected','archived'));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='mock_questions_difficulty_check' and conrelid='public.mock_questions'::regclass) then
    alter table public.mock_questions add constraint mock_questions_difficulty_check
      check (difficulty is null or difficulty in ('easy','medium','hard'));
  end if;
end $$;

update public.mock_questions
set human_verified = true, ai_generated = false, status = 'published',
    published_at = coalesce(published_at, created_at)
where published_at is null;

update public.mock_questions mq
set exam_id = e.id
from public.exams e
where mq.exam_id is null
  and ((mq.test_id='appsc-gs-1' and e.slug='appsc-group-1') or
       (mq.test_id='tspsc-gs-1' and e.slug='tspsc-group-1'));

create index if not exists idx_mock_questions_status     on public.mock_questions(status);
create index if not exists idx_mock_questions_exam_id    on public.mock_questions(exam_id);
create index if not exists idx_mock_questions_subject    on public.mock_questions(subject);
create index if not exists idx_mock_questions_topic      on public.mock_questions(topic);
create index if not exists idx_mock_questions_difficulty on public.mock_questions(difficulty);
create index if not exists idx_mock_questions_tags       on public.mock_questions using gin (tags);

create or replace function public.mock_questions_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_mock_questions_updated_at on public.mock_questions;
create trigger trg_mock_questions_updated_at
  before update on public.mock_questions
  for each row execute function public.mock_questions_touch_updated_at();

drop policy if exists "mock_questions_select_auth" on public.mock_questions;
create policy "mock_questions_select_published"
  on public.mock_questions for select to authenticated
  using (status = 'published');

alter table public.ai_drafts drop constraint if exists ai_drafts_content_type_check;
alter table public.ai_drafts add constraint ai_drafts_content_type_check
  check (content_type in ('current_affairs','notifications','exams','previous_papers','questions'));

commit;
