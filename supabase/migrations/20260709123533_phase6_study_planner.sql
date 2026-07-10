-- ============================================================================
-- 20260709123533_phase6_study_planner
--
-- Phase 6 — AI Study Planner. Two normalized, additive tables with own-row
-- RLS. No changes to existing tables. Reuses exams(id) via FK.
--
--   study_plans        — one active/archived plan per user+exam
--   study_plan_tasks    — normalized day-by-day tasks (not a JSON blob)
-- ============================================================================

begin;

create table if not exists public.study_plans (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  exam_id          uuid references public.exams(id) on delete set null,
  status           text not null default 'active' check (status in ('active','archived','completed')),
  start_date       date not null default current_date,
  target_exam_date date,
  daily_minutes    integer,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.study_plan_tasks (
  id                uuid primary key default gen_random_uuid(),
  study_plan_id     uuid not null references public.study_plans(id) on delete cascade,
  day_number        integer not null,
  task_type         text not null default 'study'
                      check (task_type in ('study','revision','mock_test','previous_paper','current_affairs')),
  subject           text,
  topic             text,
  estimated_minutes integer,
  completed         boolean not null default false,
  completed_at      timestamptz,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now()
);

create index if not exists idx_study_plans_user        on public.study_plans(user_id);
create index if not exists idx_study_plan_tasks_plan    on public.study_plan_tasks(study_plan_id);
create index if not exists idx_study_plan_tasks_plan_day on public.study_plan_tasks(study_plan_id, day_number, sort_order);

-- keep study_plans.updated_at fresh
create or replace function public.study_plans_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_study_plans_updated_at on public.study_plans;
create trigger trg_study_plans_updated_at
  before update on public.study_plans
  for each row execute function public.study_plans_touch_updated_at();

-- ── RLS: own rows only ──────────────────────────────────────────────────────
alter table public.study_plans      enable row level security;
alter table public.study_plan_tasks enable row level security;

create policy "study_plans_own"
  on public.study_plans for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- tasks are owned transitively via their plan; check the parent plan's owner
create policy "study_plan_tasks_own"
  on public.study_plan_tasks for all to authenticated
  using (exists (select 1 from public.study_plans p
                 where p.id = study_plan_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.study_plans p
                      where p.id = study_plan_id and p.user_id = auth.uid()));

-- grants (RLS still applies); anon gets nothing
grant select, insert, update, delete on public.study_plans      to authenticated;
grant select, insert, update, delete on public.study_plan_tasks to authenticated;

commit;
