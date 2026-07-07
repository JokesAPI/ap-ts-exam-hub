begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email, full_name, is_admin, created_at)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    false,
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

insert into public.profiles (id, email, full_name, is_admin, created_at)
select
  u.id,
  u.email,
  u.raw_user_meta_data->>'full_name',
  false,
  u.created_at
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

commit;