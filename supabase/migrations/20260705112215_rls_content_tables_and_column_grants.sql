begin;

-- CURRENT_AFFAIRS
alter table current_affairs enable row level security;

drop policy if exists "current_affairs_select_public" on current_affairs;
create policy "current_affairs_select_public"
on current_affairs for select to anon, authenticated using (true);

drop policy if exists "current_affairs_admin_write" on current_affairs;
create policy "current_affairs_admin_write"
on current_affairs for all to authenticated
using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

drop policy if exists "Allow public delete on current_affairs" on current_affairs;
drop policy if exists "Allow public insert on current_affairs" on current_affairs;
drop policy if exists "Allow public read on current_affairs" on current_affairs;
drop policy if exists "Allow public update on current_affairs" on current_affairs;
drop policy if exists "Auth delete current_affairs" on current_affairs;
drop policy if exists "Auth insert current_affairs" on current_affairs;
drop policy if exists "Auth update current_affairs" on current_affairs;
drop policy if exists "Public read current_affairs" on current_affairs;
drop policy if exists "current_affairs_select_all" on current_affairs;
drop policy if exists "current_affairs_write_admin" on current_affairs;

-- EXAMS
alter table exams enable row level security;

drop policy if exists "exams_select_public" on exams;
create policy "exams_select_public"
on exams for select to anon, authenticated using (true);

drop policy if exists "exams_admin_write" on exams;
create policy "exams_admin_write"
on exams for all to authenticated
using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

drop policy if exists "Allow public insert on exams" on exams;
drop policy if exists "Allow public read on exams" on exams;
drop policy if exists "Auth delete exams" on exams;
drop policy if exists "Auth insert exams" on exams;
drop policy if exists "Auth update exams" on exams;
drop policy if exists "Public read exams" on exams;
drop policy if exists "exams_select_all" on exams;
drop policy if exists "exams_write_admin" on exams;

-- NOTIFICATIONS
alter table notifications enable row level security;

drop policy if exists "notifications_select_public" on notifications;
create policy "notifications_select_public"
on notifications for select to anon, authenticated using (true);

drop policy if exists "notifications_admin_write" on notifications;
create policy "notifications_admin_write"
on notifications for all to authenticated
using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

drop policy if exists "Allow public insert on notifications" on notifications;
drop policy if exists "Allow public read on notifications" on notifications;
drop policy if exists "Allow public update on notifications" on notifications;
drop policy if exists "Auth delete notifications" on notifications;
drop policy if exists "Auth insert notifications" on notifications;
drop policy if exists "Auth update notifications" on notifications;
drop policy if exists "Public read notifications" on notifications;
drop policy if exists "notifications_select_all" on notifications;
drop policy if exists "notifications_write_admin" on notifications;

-- PREVIOUS_PAPERS
alter table previous_papers enable row level security;

drop policy if exists "previous_papers_select_public" on previous_papers;
create policy "previous_papers_select_public"
on previous_papers for select to anon, authenticated using (true);

drop policy if exists "previous_papers_admin_write" on previous_papers;
create policy "previous_papers_admin_write"
on previous_papers for all to authenticated
using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

drop policy if exists "Allow public insert on previous_papers" on previous_papers;
drop policy if exists "Allow public read on previous_papers" on previous_papers;
drop policy if exists "Auth delete previous_papers" on previous_papers;
drop policy if exists "Auth insert previous_papers" on previous_papers;
drop policy if exists "Auth update previous_papers" on previous_papers;
drop policy if exists "Public read previous_papers" on previous_papers;
drop policy if exists "papers_select_all" on previous_papers;
drop policy if exists "papers_write_admin" on previous_papers;

-- PROFILES column-grant fix + protective trigger
revoke update on profiles from authenticated;
grant update (full_name, phone, exam_target) on profiles to authenticated;

create or replace function public.protect_premium_profile_fields()
returns trigger
language plpgsql
security definer
as $$
begin
  if auth.role() <> 'service_role' then
    if new.is_pro is distinct from old.is_pro
    or new.pro_expires_at is distinct from old.pro_expires_at
    or new.is_admin is distinct from old.is_admin then
      raise exception 'Not permitted: premium/admin fields can only be changed by the server.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_premium_profile_fields on profiles;
create trigger trg_protect_premium_profile_fields
before update on profiles
for each row execute procedure public.protect_premium_profile_fields();

-- MOCK_QUESTIONS column-grant fix
revoke select on mock_questions from authenticated;
grant select (id, test_id, question, option_a, option_b, option_c, option_d, subject, difficulty, created_at)
on mock_questions to authenticated;

-- TEST_REGISTRATIONS insert policy
drop policy if exists "test_registrations_insert_anyone" on test_registrations;
create policy "test_registrations_insert_anyone"
on test_registrations for insert to anon, authenticated with check (true);

commit;