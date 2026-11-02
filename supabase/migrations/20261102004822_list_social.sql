-- Likes on lists
create table public.list_likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  list_id uuid not null references public.lists(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, list_id)
);

create index list_likes_list_idx on public.list_likes (list_id);

-- Comments on lists, with one level of replies
create table public.list_comments (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  user_id uuid not null,
  parent_id uuid,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  constraint list_comments_user_id_profiles_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade,
  constraint list_comments_id_list_key unique (id, list_id),
  -- A reply must belong to the same list as its parent
  constraint list_comments_parent_fkey
    foreign key (parent_id, list_id)
    references public.list_comments(id, list_id) on delete cascade
);

create index list_comments_list_idx
  on public.list_comments (list_id, created_at);

-- Notifications can now point at a list
alter table public.notifications
  add column list_id uuid references public.lists(id) on delete cascade;

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'like', 'comment', 'reply', 'follow',
    'list_like', 'list_comment', 'list_reply'
  ));

-- At most 5 list comments a minute and 100 a day per user
create function public.limit_list_comment_rate()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if (
    select count(*) from public.list_comments
    where user_id = new.user_id
      and created_at > now() - interval '1 minute'
  ) >= 5 then
    raise exception 'You are commenting too fast. Please wait a minute.';
  end if;

  if (
    select count(*) from public.list_comments
    where user_id = new.user_id
      and created_at > now() - interval '1 day'
  ) >= 100 then
    raise exception 'Daily comment limit reached. Try again tomorrow.';
  end if;

  return new;
end;
$$;

create trigger list_comments_rate_limit
  before insert on public.list_comments
  for each row execute function public.limit_list_comment_rate();

-- Notify the list's owner of a like (once per person per list)
create function public.notify_on_list_like()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.notifications (recipient_id, actor_id, type, list_id)
  select l.user_id, new.user_id, 'list_like', new.list_id
  from public.lists l
  where l.id = new.list_id
    and l.user_id <> new.user_id
    and not exists (
      select 1 from public.notifications n
      where n.recipient_id = l.user_id
        and n.actor_id = new.user_id
        and n.type = 'list_like'
        and n.list_id = new.list_id
    );
  return new;
end;
$$;

create trigger list_likes_notify
  after insert on public.list_likes
  for each row execute function public.notify_on_list_like();

-- Notify on comments and replies
create function public.notify_on_list_comment()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  list_owner uuid;
  parent_author uuid;
begin
  select user_id into list_owner from public.lists where id = new.list_id;

  if new.parent_id is not null then
    select user_id into parent_author
    from public.list_comments where id = new.parent_id;

    if parent_author is not null and parent_author <> new.user_id then
      insert into public.notifications (recipient_id, actor_id, type, list_id)
      values (parent_author, new.user_id, 'list_reply', new.list_id);
    end if;
  end if;

  if list_owner is not null
     and list_owner <> new.user_id
     and list_owner is distinct from parent_author then
    insert into public.notifications (recipient_id, actor_id, type, list_id)
    values (list_owner, new.user_id, 'list_comment', new.list_id);
  end if;

  return new;
end;
$$;

create trigger list_comments_notify
  after insert on public.list_comments
  for each row execute function public.notify_on_list_comment();

-- Row Level Security
alter table public.list_likes enable row level security;
alter table public.list_comments enable row level security;

create policy "list likes are public"
  on public.list_likes for select using (true);

-- You can like anyone's list except your own
create policy "users like lists as themselves"
  on public.list_likes for insert
  with check (
    (select auth.uid()) = user_id
    and not exists (
      select 1 from public.lists l
      where l.id = list_likes.list_id
        and l.user_id = (select auth.uid())
    )
  );
create policy "users unlike lists as themselves"
  on public.list_likes for delete
  using ((select auth.uid()) = user_id);

create policy "list comments are public"
  on public.list_comments for select using (true);
create policy "users comment on lists as themselves"
  on public.list_comments for insert
  with check ((select auth.uid()) = user_id);
create policy "authors and list owners delete list comments"
  on public.list_comments for delete
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.lists l
      where l.id = list_comments.list_id
        and l.user_id = (select auth.uid())
    )
  );

grant select on public.list_likes to anon, authenticated;
grant insert, delete on public.list_likes to authenticated;
grant all on public.list_likes to service_role;

grant select on public.list_comments to anon, authenticated;
grant insert, delete on public.list_comments to authenticated;
grant all on public.list_comments to service_role;