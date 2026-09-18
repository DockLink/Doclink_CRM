-- Run this in the Supabase SQL Editor after creating the Auth user.
-- The password belongs only in Supabase Auth and is intentionally not stored here.

alter table public.users enable row level security;

drop policy if exists "Users can read their own CRM profile" on public.users;
create policy "Users can read their own CRM profile"
on public.users
for select
to authenticated
using (lower(email) = lower((select auth.jwt() ->> 'email')));

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', 'superadmin')
where lower(email) = lower('superadmin@doclink.com');

insert into public.users (id, name, email, password_hash, role, is_active)
select id, 'Super Admin', email, 'supabase-managed', 'superadmin', true
from auth.users
where lower(email) = lower('superadmin@doclink.com')
on conflict (email) do update
set name = excluded.name,
    role = 'superadmin',
    is_active = true;