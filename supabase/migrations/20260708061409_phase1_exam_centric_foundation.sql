begin;

alter table public.exams
  add column if not exists title            text,
  add column if not exists organization     text,
  add column if not exists description      text,
  add column if not exists exam_date        date,
  add column if not exists last_date        date,
  add column if not exists status           text default 'Upcoming',
  add column if not exists notification_url text,
  add column if not exists slug             text,
  add column if not exists category         text,
  add column if not exists state            text,
  add column if not exists is_active        boolean not null default true,
  add column if not exists display_order    integer not null default 100;

update public.exams set title = exam_name where title is null;

create unique index if not exists exams_slug_key
  on public.exams (slug) where slug is not null;

alter table public.profiles
  add column if not exists selected_exam_id uuid references public.exams(id) on delete set null;

alter table public.previous_papers
  add column if not exists exam_id uuid references public.exams(id) on delete set null;

insert into public.exams
  (exam_name, title, organization, category, state, status, is_active, display_order, slug)
values
  ('APPSC Group-1',            'APPSC Group-1',            'APPSC',     'state-psc', 'AP',   'Upcoming', true, 10, 'appsc-group-1'),
  ('APPSC Group-2',            'APPSC Group-2',            'APPSC',     'state-psc', 'AP',   'Upcoming', true, 11, 'appsc-group-2'),
  ('APPSC Group-3',            'APPSC Group-3',            'APPSC',     'state-psc', 'AP',   'Upcoming', true, 12, 'appsc-group-3'),
  ('TSPSC Group-1',            'TSPSC Group-1',            'TSPSC',     'state-psc', 'TS',   'Upcoming', true, 13, 'tspsc-group-1'),
  ('TSPSC Group-2',            'TSPSC Group-2',            'TSPSC',     'state-psc', 'TS',   'Upcoming', true, 14, 'tspsc-group-2'),
  ('TSPSC Group-3',            'TSPSC Group-3',            'TSPSC',     'state-psc', 'TS',   'Upcoming', true, 15, 'tspsc-group-3'),
  ('AP EAPCET',                'AP EAPCET',                'APSCHE',    'entrance',  'AP',   'Upcoming', true, 20, 'ap-eapcet'),
  ('TG EAPCET',                'TG EAPCET',                'TGCHE',     'entrance',  'TS',   'Upcoming', true, 21, 'tg-eapcet'),
  ('AP POLYCET',               'AP POLYCET',               'SBTET AP',  'entrance',  'AP',   'Upcoming', true, 22, 'ap-polycet'),
  ('TG POLYCET',               'TG POLYCET',               'SBTET TG',  'entrance',  'TS',   'Upcoming', true, 23, 'tg-polycet'),
  ('AP ECET',                  'AP ECET',                  'APSCHE',    'entrance',  'AP',   'Upcoming', true, 24, 'ap-ecet'),
  ('TG ECET',                  'TG ECET',                  'TGCHE',     'entrance',  'TS',   'Upcoming', true, 25, 'tg-ecet'),
  ('AP TET',                   'AP TET',                   'AP DSE',    'teaching',  'AP',   'Upcoming', true, 30, 'ap-tet'),
  ('TG TET',                   'TG TET',                   'TG DSE',    'teaching',  'TS',   'Upcoming', true, 31, 'tg-tet'),
  ('AP DSC',                   'AP DSC',                   'AP DSE',    'teaching',  'AP',   'Upcoming', true, 32, 'ap-dsc'),
  ('TS DSC',                   'TS DSC',                   'TG DSE',    'teaching',  'TS',   'Upcoming', true, 33, 'ts-dsc'),
  ('AP Police SI',             'AP Police SI',             'APSLPRB',   'police',    'AP',   'Upcoming', true, 40, 'ap-police-si'),
  ('TS Police SI',             'TS Police SI',             'TSLPRB',    'police',    'TS',   'Upcoming', true, 41, 'ts-police-si'),
  ('AP Police Constable',      'AP Police Constable',      'APSLPRB',   'police',    'AP',   'Upcoming', true, 42, 'ap-police-constable'),
  ('TS Police Constable',      'TS Police Constable',      'TSLPRB',    'police',    'TS',   'Upcoming', true, 43, 'ts-police-constable'),
  ('SSC CGL',                  'SSC CGL',                  'SSC',       'ssc',       'both', 'Upcoming', true, 50, 'ssc-cgl'),
  ('SSC CHSL',                 'SSC CHSL',                 'SSC',       'ssc',       'both', 'Upcoming', true, 51, 'ssc-chsl'),
  ('RRB NTPC',                 'RRB NTPC',                 'RRB',       'railway',   'both', 'Upcoming', true, 60, 'rrb-ntpc'),
  ('RRB Group D',              'RRB Group D',              'RRB',       'railway',   'both', 'Upcoming', true, 61, 'rrb-group-d'),
  ('IBPS PO',                  'IBPS PO',                  'IBPS',      'banking',   'both', 'Upcoming', true, 70, 'ibps-po'),
  ('IBPS Clerk',               'IBPS Clerk',               'IBPS',      'banking',   'both', 'Upcoming', true, 71, 'ibps-clerk'),
  ('SBI PO',                   'SBI PO',                   'SBI',       'banking',   'both', 'Upcoming', true, 72, 'sbi-po')
on conflict (slug) where slug is not null
do update set
  title         = excluded.title,
  organization  = excluded.organization,
  category      = excluded.category,
  state         = excluded.state,
  is_active     = excluded.is_active,
  display_order = excluded.display_order;

commit;