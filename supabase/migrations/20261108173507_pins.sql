-- ABOUTME: Lets people pin up to three of their own logs or lists to the top of their profile.
-- ABOUTME: One row per pin; a pin points at either a log or a list, and goes when either is deleted.

create table public.pins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  log_id uuid references public.logs(id) on delete cascade,
  list_id uuid references public.lists(id) on delete cascade,
  pinned_at timestamptz not null default now(),
  constraint pins_user_id_profiles_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade,
  -- A pin is of a log or of a list, never both
  constraint pins_one_target check ((log_id is null) <> (list_id is null))
);

create unique index pins_user_log_idx on public.pins (user_id, log_id)
  where log_id is not null;
create unique index pins_user_list_idx on public.pins (user_id, list_id)
  where list_id is not null;
create index pins_user_pinned_idx on public.pins (user_id, pinned_at desc);

-- At most 3 pins per person
create function public.limit_pins()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if (select count(*) from public.pins where user_id = new.user_id) >= 3 then
    raise exception 'You can pin at most 3 things. Unpin one first.';
  end if;
  return new;
end;
$$;

create trigger pins_limit
  before insert on public.pins
  for each row execute function public.limit_pins();

alter table public.pins enable row level security;

create policy "pins are public"
  on public.pins for select using (true);

-- You can only pin your own logs and lists
create policy "users pin their own things"
  on public.pins for insert
  with check (
    (select auth.uid()) = user_id
    and (
      exists (
        select 1 from public.logs l
        where l.id = pins.log_id and l.user_id = (select auth.uid())
      )
      or exists (
        select 1 from public.lists l
        where l.id = pins.list_id and l.user_id = (select auth.uid())
      )
    )
  );

create policy "users unpin their own things"
  on public.pins for delete
  using ((select auth.uid()) = user_id);

grant select on public.pins to anon, authenticated;
grant insert, delete on public.pins to authenticated;
grant all on public.pins to service_role;

notify pgrst, 'reload schema';