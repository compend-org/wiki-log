-- Site admins: they get the admin badge and can ban people
create table public.admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- Anyone can see who the admins are, because the badge is public. There are
-- no insert, update or delete policies: only you, in the dashboard, can
-- change who is an admin.
create policy "admins are public"
  on public.admins for select using (true);

grant select on public.admins to anon, authenticated;
revoke insert, update, delete, truncate on public.admins from anon, authenticated;
grant all on public.admins to service_role;
