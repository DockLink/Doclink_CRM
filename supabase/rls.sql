-- Run this in the Supabase SQL Editor (or psql as postgres). Safe to re-run.
-- CRM data is read and written only through the Next.js API, which uses Prisma as the
-- table-owning postgres role (bypasses RLS). The browser's anon key must not reach these
-- tables through the Supabase REST API; signed-in users may only read their own profile row.

alter table public.users enable row level security;
alter table public.leads enable row level security;
alter table public.activities enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.lead_sources enable row level security;
alter table public.custom_fields enable row level security;
alter table public.lead_custom_field_values enable row level security;
alter table public._prisma_migrations enable row level security;

-- TRUNCATE is not subject to RLS, so table privileges are removed as well.
revoke all on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;

-- proxy.ts and lib/role-context.tsx read name/role/is_active for the signed-in user.
grant select (id, name, email, role, is_active) on public.users to authenticated;

drop policy if exists "Users can read their own CRM profile" on public.users;
create policy "Users can read their own CRM profile"
on public.users
for select
to authenticated
using (lower(email) = lower((select auth.jwt() ->> 'email')));
