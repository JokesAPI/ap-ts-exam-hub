-- ============================================================
-- V2 SCHEMA: User Accounts + Subscriptions + Mock Tests
-- Run in Supabase SQL Editor
-- ============================================================

-- USER PROFILES
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  email text,
  phone text,
  exam_target text,
  is_pro boolean default false,
  pro_expires_at timestamptz,
  created_at timestamptz default now()
);

-- SUBSCRIPTIONS
create table if not exists subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  razorpay_payment_id text,
  razorpay_order_id text,
  amount integer default 9900,
  status text default 'pending',
  created_at timestamptz default now(),
  expires_at timestamptz
);

-- MOCK TEST QUESTIONS
create table if not exists mock_questions (
  id uuid default gen_random_uuid() primary key,
  test_id text not null,
  question text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_answer text not null,
  explanation text,
  subject text,
  difficulty text default 'medium',
  created_at timestamptz default now()
);

-- MOCK TEST RESULTS
create table if not exists mock_results (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  test_id text not null,
  score integer,
  total integer,
  time_taken integer,
  answers jsonb,
  created_at timestamptz default now()
);

-- BOOKMARKS
create table if not exists bookmarks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  item_type text,
  item_id uuid,
  created_at timestamptz default now()
);

-- DISABLE RLS FOR ALL NEW TABLES
alter table profiles disable row level security;
alter table subscriptions disable row level security;
alter table mock_questions disable row level security;
alter table mock_results disable row level security;
alter table bookmarks disable row level security;

-- GRANT ACCESS
grant all on public.profiles to anon, authenticated;
grant all on public.subscriptions to anon, authenticated;
grant all on public.mock_questions to anon, authenticated;
grant all on public.mock_results to anon, authenticated;
grant all on public.bookmarks to anon, authenticated;
grant usage on schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;

-- AUTO CREATE PROFILE ON SIGNUP
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- SAMPLE MOCK QUESTIONS
insert into mock_questions (test_id, question, option_a, option_b, option_c, option_d, correct_answer, explanation, subject) values
('appsc-gs-1', 'Who was the first Chief Minister of Andhra Pradesh?', 'T. Prakasam', 'N. Sanjeeva Reddy', 'B. Gopala Reddy', 'D. Narayana Raju', 'B', 'Neelam Sanjeeva Reddy was the first Chief Minister of Andhra Pradesh after its formation in 1956.', 'AP History'),
('appsc-gs-1', 'Which river is known as the Godavari of South India?', 'Krishna', 'Tungabhadra', 'Godavari', 'Pennar', 'C', 'Godavari is called the Ganga of South India due to its sacred significance and large size.', 'Geography'),
('appsc-gs-1', 'APPSC was established in which year?', '1950', '1956', '1947', '1953', 'B', 'APPSC was established in 1956 when Andhra Pradesh state was formed.', 'General Knowledge'),
('appsc-gs-1', 'Which is the largest district of Andhra Pradesh by area?', 'Kurnool', 'Prakasam', 'Nellore', 'Anantapur', 'D', 'Anantapur is the largest district of Andhra Pradesh by geographical area.', 'AP Geography'),
('appsc-gs-1', 'The Nagarjuna Sagar Dam is located on which river?', 'Godavari', 'Krishna', 'Tungabhadra', 'Pennar', 'B', 'Nagarjuna Sagar Dam is built across the Krishna River in Nalgonda district.', 'Geography'),
('appsc-gs-1', 'Who is the author of Manucharitra?', 'Allasani Peddana', 'Tenali Ramakrishna', 'Potana', 'Nannaya', 'A', 'Allasani Peddana wrote Manucharitra and is known as Andhra Kavita Pitamaha.', 'AP Literature'),
('appsc-gs-1', 'Srisailam project is built on which river?', 'Godavari', 'Krishna', 'Pennar', 'Tungabhadra', 'B', 'Srisailam Dam is built on the Krishna River in Nandyal district of Andhra Pradesh.', 'Geography'),
('appsc-gs-1', 'Which city is known as the Cultural Capital of Andhra Pradesh?', 'Vijayawada', 'Visakhapatnam', 'Rajahmundry', 'Tirupati', 'C', 'Rajahmundry is known as the Cultural Capital of Andhra Pradesh due to its rich literary and cultural heritage.', 'AP Culture'),
('appsc-gs-1', 'The Panchayat Raj System in India was introduced based on which committee recommendations?', 'Balwant Rai Mehta Committee', 'Ashok Mehta Committee', 'LM Singhvi Committee', 'Sarkaria Committee', 'A', 'The Balwant Rai Mehta Committee recommended the three-tier Panchayati Raj system in 1957.', 'Polity'),
('appsc-gs-1', 'Article 356 of Indian Constitution is related to?', 'Emergency due to war', 'Financial Emergency', 'Presidents Rule in States', 'Fundamental Rights', 'C', 'Article 356 provides for the imposition of President Rule in a state when constitutional machinery fails.', 'Constitution');

select 'Schema v2 created successfully!' as status;
