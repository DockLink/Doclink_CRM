-- Run this in the Supabase SQL Editor after Auth + CRM users exist.
-- Keeps middleware (supabase.from("users")) able to resolve role/is_active.
-- The login password lives only in Supabase Auth.

grant usage on schema public to authenticated;
grant select on table public.users to authenticated;

alter table public.users enable row level security;

drop policy if exists "Users can read their own CRM profile" on public.users;
create policy "Users can read their own CRM profile"
on public.users
for select
to authenticated
using (id = auth.uid());

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', 'superadmin')
where lower(email) = lower('superadmin@doclink.com');

-- Align CRM row id with Auth user id (FKs use ON UPDATE CASCADE).
insert into public.users (id, name, email, password_hash, role, is_active)
select id, 'Super Admin', email, 'supabase-managed', 'superadmin'::"Role", true
from auth.users
where lower(email) = lower('superadmin@doclink.com')
on conflict (email) do update
set
  id = excluded.id,
  name = excluded.name,
  role = 'superadmin',
  is_active = true;
