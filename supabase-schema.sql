-- ============================================================
-- AP TS EXAM HUB - Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- NOTIFICATIONS
create table if not exists notifications (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  category text,
  link text,
  is_important boolean default false,
  created_at timestamptz default now()
);

-- EXAMS
create table if not exists exams (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  organization text,
  description text,
  exam_date date,
  last_date date,
  status text default 'Upcoming',
  notification_url text,
  created_at timestamptz default now()
);

-- CURRENT AFFAIRS
create table if not exists current_affairs (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  content text,
  category text,
  published_date date,
  created_at timestamptz default now()
);

-- PREVIOUS PAPERS
create table if not exists previous_papers (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  organization text,
  year integer,
  subject text,
  description text,
  pdf_url text,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table notifications enable row level security;
alter table exams enable row level security;
alter table current_affairs enable row level security;
alter table previous_papers enable row level security;

-- Public READ for all tables
create policy "Public read notifications" on notifications for select using (true);
create policy "Public read exams" on exams for select using (true);
create policy "Public read current_affairs" on current_affairs for select using (true);
create policy "Public read previous_papers" on previous_papers for select using (true);

-- Authenticated WRITE for all tables
create policy "Auth insert notifications" on notifications for insert with check (auth.role() = 'authenticated');
create policy "Auth update notifications" on notifications for update using (auth.role() = 'authenticated');
create policy "Auth delete notifications" on notifications for delete using (auth.role() = 'authenticated');

create policy "Auth insert exams" on exams for insert with check (auth.role() = 'authenticated');
create policy "Auth update exams" on exams for update using (auth.role() = 'authenticated');
create policy "Auth delete exams" on exams for delete using (auth.role() = 'authenticated');

create policy "Auth insert current_affairs" on current_affairs for insert with check (auth.role() = 'authenticated');
create policy "Auth update current_affairs" on current_affairs for update using (auth.role() = 'authenticated');
create policy "Auth delete current_affairs" on current_affairs for delete using (auth.role() = 'authenticated');

create policy "Auth insert previous_papers" on previous_papers for insert with check (auth.role() = 'authenticated');
create policy "Auth update previous_papers" on previous_papers for update using (auth.role() = 'authenticated');
create policy "Auth delete previous_papers" on previous_papers for delete using (auth.role() = 'authenticated');

-- ============================================================
-- STORAGE BUCKET FOR PDFs
-- Run separately in Supabase Storage settings or via SQL:
-- ============================================================
-- insert into storage.buckets (id, name, public) values ('pdfs', 'pdfs', true);
-- create policy "Public read pdfs" on storage.objects for select using (bucket_id = 'pdfs');
-- create policy "Auth upload pdfs" on storage.objects for insert with check (bucket_id = 'pdfs' and auth.role() = 'authenticated');
