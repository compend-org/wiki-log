-- ============ Tables ============

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now(),
  constraint profiles_username_format check (
    char_length(username) between 2 and 30
    and username = btrim(username)
    and username !~ '[[:cntrl:]]'
    and username !~ '\s\s'
  )
);

create unique index profiles_username_lower_idx
  on public.profiles (lower(username));

create table public.items (
  id text primary key,
  title text not null,
  description text,
  image_url text,
  page_url text not null,
  fetched_at timestamptz not null default now()
);

create table public.logs (
  user_id uuid not null,
  item_id text not null references public.items(id),
  rating numeric(2,1) not null
    check (rating between 0.5 and 5 and rating * 2 = floor(rating * 2)),
  review text not null default '',
  logged_at timestamptz not null default now(),
  primary key (user_id, item_id),
  constraint logs_user_id_profiles_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade
);

create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table public.favourites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  position smallint not null check (position between 1 and 5),
  item_id text not null references public.items(id),
  primary key (user_id, position),
  unique (user_id, item_id)
);

create table public.likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  log_user_id uuid not null,
  log_item_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, log_user_id, log_item_id),
  foreign key (log_user_id, log_item_id)
    references public.logs(user_id, item_id) on delete cascade,
  check (user_id <> log_user_id)
);

create index likes_log_idx on public.likes (log_user_id, log_item_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  log_user_id uuid not null,
  log_item_id text not null,
  user_id uuid not null,
  parent_id uuid,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  constraint comments_user_id_profiles_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade,
  constraint comments_log_fkey
    foreign key (log_user_id, log_item_id)
    references public.logs(user_id, item_id) on delete cascade,
  constraint comments_id_log_key unique (id, log_user_id, log_item_id),
  constraint comments_parent_fkey
    foreign key (parent_id, log_user_id, log_item_id)
    references public.comments(id, log_user_id, log_item_id) on delete cascade
);

create index comments_log_idx
  on public.comments (log_user_id, log_item_id, created_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null,
  actor_id uuid not null,
  type text not null check (type in ('like', 'comment', 'reply', 'follow')),
  log_user_id uuid,
  log_item_id text,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  check (recipient_id <> actor_id),
  constraint notifications_recipient_fkey
    foreign key (recipient_id) references public.profiles(id) on delete cascade,
  constraint notifications_actor_fkey
    foreign key (actor_id) references public.profiles(id) on delete cascade,
  constraint notifications_log_fkey
    foreign key (log_user_id, log_item_id)
    references public.logs(user_id, item_id) on delete cascade
);

create index notifications_recipient_idx
  on public.notifications (recipient_id, created_at desc);

-- ============ Functions and triggers ============

-- A profile for each new sign-up, using the chosen name when valid and free
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  wanted text := regexp_replace(
    btrim(coalesce(new.raw_user_meta_data ->> 'username', '')), '\s+', ' ', 'g'
  );
  fallback text := 'user_' || substr(replace(new.id::text, '-', ''), 1, 10);
begin
  if char_length(wanted) not between 2 and 30
     or wanted ~ '[[:cntrl:]]'
     or exists (
       select 1 from public.profiles where lower(username) = lower(wanted)
     ) then
    wanted := fallback;
  end if;

  begin
    insert into public.profiles (id, username) values (new.id, wanted);
  exception when unique_violation then
    insert into public.profiles (id, username) values (new.id, fallback);
  end;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- At most 5 comments a minute and 100 a day per user
create function public.limit_comment_rate()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if (
    select count(*) from public.comments
    where user_id = new.user_id
      and created_at > now() - interval '1 minute'
  ) >= 5 then
    raise exception 'You are commenting too fast. Please wait a minute.';
  end if;

  if (
    select count(*) from public.comments
    where user_id = new.user_id
      and created_at > now() - interval '1 day'
  ) >= 100 then
    raise exception 'Daily comment limit reached. Try again tomorrow.';
  end if;

  return new;
end;
$$;

create trigger comments_rate_limit
  before insert on public.comments
  for each row execute function public.limit_comment_rate();

-- Notifications
create function public.notify_on_like()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.notifications
    (recipient_id, actor_id, type, log_user_id, log_item_id)
  select new.log_user_id, new.user_id, 'like', new.log_user_id, new.log_item_id
  where not exists (
    select 1 from public.notifications n
    where n.recipient_id = new.log_user_id
      and n.actor_id = new.user_id
      and n.type = 'like'
      and n.log_user_id = new.log_user_id
      and n.log_item_id = new.log_item_id
  );
  return new;
end;
$$;

create trigger likes_notify
  after insert on public.likes
  for each row execute function public.notify_on_like();

create function public.notify_on_comment()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  parent_author uuid;
begin
  if new.parent_id is not null then
    select user_id into parent_author
    from public.comments where id = new.parent_id;

    if parent_author is not null and parent_author <> new.user_id then
      insert into public.notifications
        (recipient_id, actor_id, type, log_user_id, log_item_id)
      values
        (parent_author, new.user_id, 'reply', new.log_user_id, new.log_item_id);
    end if;
  end if;

  if new.log_user_id <> new.user_id
     and new.log_user_id is distinct from parent_author then
    insert into public.notifications
      (recipient_id, actor_id, type, log_user_id, log_item_id)
    values
      (new.log_user_id, new.user_id, 'comment', new.log_user_id, new.log_item_id);
  end if;

  return new;
end;
$$;

create trigger comments_notify
  after insert on public.comments
  for each row execute function public.notify_on_comment();

create function public.notify_on_follow()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.notifications (recipient_id, actor_id, type)
  select new.following_id, new.follower_id, 'follow'
  where not exists (
    select 1 from public.notifications n
    where n.recipient_id = new.following_id
      and n.actor_id = new.follower_id
      and n.type = 'follow'
  );
  return new;
end;
$$;

create trigger follows_notify
  after insert on public.follows
  for each row execute function public.notify_on_follow();

-- ============ Row Level Security ============

alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.logs enable row level security;
alter table public.follows enable row level security;
alter table public.favourites enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.notifications enable row level security;

create policy "profiles are public"
  on public.profiles for select using (true);
create policy "users update own profile"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "items are public"
  on public.items for select using (true);

create policy "logs are public"
  on public.logs for select using (true);
create policy "users insert own logs"
  on public.logs for insert with check ((select auth.uid()) = user_id);
create policy "users update own logs"
  on public.logs for update using ((select auth.uid()) = user_id);
create policy "users delete own logs"
  on public.logs for delete using ((select auth.uid()) = user_id);

create policy "follows are public"
  on public.follows for select using (true);
create policy "users follow as themselves"
  on public.follows for insert
  with check ((select auth.uid()) = follower_id);
create policy "users unfollow as themselves"
  on public.follows for delete
  using ((select auth.uid()) = follower_id);

create policy "favourites are public"
  on public.favourites for select using (true);
create policy "users insert own favourites"
  on public.favourites for insert
  with check ((select auth.uid()) = user_id);
create policy "users update own favourites"
  on public.favourites for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "users delete own favourites"
  on public.favourites for delete
  using ((select auth.uid()) = user_id);

create policy "likes are public"
  on public.likes for select using (true);
create policy "users like as themselves"
  on public.likes for insert
  with check ((select auth.uid()) = user_id);
create policy "users unlike as themselves"
  on public.likes for delete
  using ((select auth.uid()) = user_id);

create policy "comments are public"
  on public.comments for select using (true);
create policy "users comment as themselves"
  on public.comments for insert
  with check ((select auth.uid()) = user_id);
create policy "authors and review owners delete comments"
  on public.comments for delete
  using (
    (select auth.uid()) = user_id
    or (select auth.uid()) = log_user_id
  );

create policy "read own notifications"
  on public.notifications for select
  using ((select auth.uid()) = recipient_id);
create policy "update own notifications"
  on public.notifications for update
  using ((select auth.uid()) = recipient_id)
  with check ((select auth.uid()) = recipient_id);
create policy "delete own notifications"
  on public.notifications for delete
  using ((select auth.uid()) = recipient_id);

-- ============ Grants ============

grant select on public.profiles to anon, authenticated;
grant update (username) on public.profiles to authenticated;
grant all on public.profiles to service_role;

grant select on public.items to anon, authenticated;
grant all on public.items to service_role;

grant select on public.logs to anon, authenticated;
grant insert, update, delete on public.logs to authenticated;
grant all on public.logs to service_role;

grant select on public.follows to anon, authenticated;
grant insert, delete on public.follows to authenticated;
grant all on public.follows to service_role;

grant select on public.favourites to anon, authenticated;
grant insert, update, delete on public.favourites to authenticated;
grant all on public.favourites to service_role;

grant select on public.likes to anon, authenticated;
grant insert, delete on public.likes to authenticated;
grant all on public.likes to service_role;

grant select on public.comments to anon, authenticated;
grant insert, delete on public.comments to authenticated;
grant all on public.comments to service_role;

grant select, delete on public.notifications to authenticated;
grant update (read) on public.notifications to authenticated;
grant all on public.notifications to service_role;