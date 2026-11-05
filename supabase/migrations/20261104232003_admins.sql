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

-- D.E. and Fed. Their accounts only exist in production, so anywhere else
-- this adds nobody.
insert into public.admins (user_id)
select id from public.profiles
where id in (
  'bc1bd2c9-26f5-4f08-83a8-bb4fab2e25f1',
  'f3aa1b1d-16c8-4fbf-b0f0-d9636ace411f'
);
