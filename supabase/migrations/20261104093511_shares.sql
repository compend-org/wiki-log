-- Sharing (reposting) reviews and lists
create table public.shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  log_id uuid references public.logs(id) on delete cascade,
  list_id uuid references public.lists(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- a share points at a review or a list, never both
  check ((log_id is null) <> (list_id is null))
);

-- One share per person per post
create unique index shares_user_log_key
  on public.shares (user_id, log_id) where log_id is not null;
create unique index shares_user_list_key
  on public.shares (user_id, list_id) where list_id is not null;

create index shares_log_idx on public.shares (log_id) where log_id is not null;
create index shares_list_idx on public.shares (list_id) where list_id is not null;
create index shares_user_created_idx on public.shares (user_id, created_at desc);

-- Notifications can now be about shares
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'like', 'comment', 'reply', 'follow',
    'list_like', 'list_comment', 'list_reply',
    'share', 'list_share'
  ));

-- Tell the owner (once per person per post)
create function public.notify_on_share()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.log_id is not null then
    insert into public.notifications (recipient_id, actor_id, type, log_id)
    select g.user_id, new.user_id, 'share', new.log_id
    from public.logs g
    where g.id = new.log_id
      and g.user_id <> new.user_id
      and not exists (
        select 1 from public.notifications n
        where n.recipient_id = g.user_id
          and n.actor_id = new.user_id
          and n.type = 'share'
          and n.log_id = new.log_id
      );
  else
    insert into public.notifications (recipient_id, actor_id, type, list_id)
    select l.user_id, new.user_id, 'list_share', new.list_id
    from public.lists l
    where l.id = new.list_id
      and l.user_id <> new.user_id
      and not exists (
        select 1 from public.notifications n
        where n.recipient_id = l.user_id
          and n.actor_id = new.user_id
          and n.type = 'list_share'
          and n.list_id = new.list_id
      );
  end if;
  return new;
end;
$$;

create trigger shares_notify
  after insert on public.shares
  for each row execute function public.notify_on_share();

-- Row Level Security
alter table public.shares enable row level security;

create policy "shares are public"
  on public.shares for select using (true);

-- You can share anyone's post except your own
create policy "users share as themselves"
  on public.shares for insert
  with check (
    (select auth.uid()) = user_id
    and not exists (
      select 1 from public.logs g
      where g.id = shares.log_id and g.user_id = (select auth.uid())
    )
    and not exists (
      select 1 from public.lists l
      where l.id = shares.list_id and l.user_id = (select auth.uid())
    )
  );

create policy "users unshare as themselves"
  on public.shares for delete
  using ((select auth.uid()) = user_id);

grant select on public.shares to anon, authenticated;
grant insert, delete on public.shares to authenticated;
grant all on public.shares to service_role;