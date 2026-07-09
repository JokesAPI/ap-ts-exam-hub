begin;

-- (1) Canonical APPSC Group-2 -------------------------------------------------
update public.exams set slug = null
where id = '9c41ad4a-a9d1-4915-8fba-52c0446487da';

update public.exams set
  slug          = 'appsc-group-2',
  exam_name     = 'APPSC Group-2',
  title         = 'APPSC Group 2 Services',
  organization  = 'APPSC',
  category      = 'state-psc',
  state         = 'AP',
  status        = 'Upcoming',
  is_active     = true,
  display_order = 11
where id = 'fa4bfb17-3769-416d-b5d3-ad71f3e27a72';

update public.profiles
set selected_exam_id = 'fa4bfb17-3769-416d-b5d3-ad71f3e27a72'
where selected_exam_id in ('9c41ad4a-a9d1-4915-8fba-52c0446487da',
                           '6f0a3c94-0260-4b87-b7a8-24db9f18ee96');

update public.previous_papers
set exam_id = 'fa4bfb17-3769-416d-b5d3-ad71f3e27a72'
where exam_id in ('9c41ad4a-a9d1-4915-8fba-52c0446487da',
                  '6f0a3c94-0260-4b87-b7a8-24db9f18ee96');

delete from public.exams
where id in ('9c41ad4a-a9d1-4915-8fba-52c0446487da',
             '6f0a3c94-0260-4b87-b7a8-24db9f18ee96');

-- (2) "Services" titles ---------------------------------------------------------
update public.exams set title = 'APPSC Group 1 Services' where slug = 'appsc-group-1';
update public.exams set title = 'APPSC Group 3 Services' where slug = 'appsc-group-3';
update public.exams set title = 'TSPSC Group 1 Services' where slug = 'tspsc-group-1';
update public.exams set title = 'TSPSC Group 2 Services' where slug = 'tspsc-group-2';
update public.exams set title = 'TSPSC Group 3 Services' where slug = 'tspsc-group-3';

-- (3) TG naming (titles + permanent slugs, pre-freeze) --------------------------
update public.exams set
  slug = 'tg-dsc', exam_name = 'TG DSC', title = 'TG DSC', organization = 'TG DSE'
where slug = 'ts-dsc';

update public.exams set
  slug = 'tg-police-si', exam_name = 'TG Police SI', title = 'TG Police SI',
  organization = 'TG Police'
where slug = 'ts-police-si';

update public.exams set
  slug = 'tg-police-constable', exam_name = 'TG Police Constable',
  title = 'TG Police Constable', organization = 'TG Police'
where slug = 'ts-police-constable';

update public.exams set organization = 'AP Police'
where slug in ('ap-police-si', 'ap-police-constable');

-- (4) Approved catalog additions -------------------------------------------------
insert into public.exams
  (exam_name, title, organization, category, state, status, is_active, display_order, slug)
values
  ('SSC MTS',   'SSC MTS',   'SSC', 'ssc',     'both', 'Upcoming', true, 52, 'ssc-mts'),
  ('SBI Clerk', 'SBI Clerk', 'SBI', 'banking', 'both', 'Upcoming', true, 73, 'sbi-clerk')
on conflict (slug) where slug is not null do nothing;

-- (5) Missing UPDATE grant (fixes broken exam save) ------------------------------
grant update (selected_exam_id) on public.profiles to authenticated;

-- (6) Slug immutability ----------------------------------------------------------
create or replace function public.exams_protect_slug()
returns trigger
language plpgsql
security definer
as $$
begin
  if old.slug is not null and new.slug is distinct from old.slug then
    if coalesce(auth.role(), '') in ('authenticated', 'anon') then
      raise exception 'Exam slugs are permanent and cannot be changed.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_exams_protect_slug on public.exams;
create trigger trg_exams_protect_slug
  before update on public.exams
  for each row execute function public.exams_protect_slug();

-- (7) previous_papers schema reconciliation (P0-class fix) ------------------------
alter table public.previous_papers
  add column if not exists organization text,
  add column if not exists year         integer,
  add column if not exists subject      text,
  add column if not exists description  text;

update public.previous_papers
set organization = exam_category
where organization is null and exam_category is not null;

commit;
