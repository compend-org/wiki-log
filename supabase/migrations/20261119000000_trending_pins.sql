-- A post can be pinned to a place in Trending until a set time. Add rows from the
-- SQL editor; there is no way to add one from the site.
create table public.trending_pins (
  log_id uuid primary key references public.logs(id) on delete cascade,
  -- 1 is the top of Trending
  position integer not null default 3 check (position >= 1),
  expires_at timestamptz not null
);
alter table public.trending_pins enable row level security;
create policy "anyone sees live pins" on public.trending_pins
  for select using (expires_at > now());
grant select on public.trending_pins to anon, authenticated;
grant all on public.trending_pins to service_role;
