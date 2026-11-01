-- Tables
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

-- Names are unique ignoring case ("Leo" and "leo" are the same name)
create unique index profiles_username_lower_idx
  on public.profiles (lower(username));

create table public.videos (
  id text primary key,
  title text not null,
  channel_name text,
  fetched_at timestamptz not null default now()
);

create table public.logs (
  user_id uuid not null,
  video_id text not null references public.videos(id),
  rating numeric(2,1) not null check (rating between 0.5 and 5 and rating * 2 = floor(rating * 2)),  review text not null default '',
  logged_at timestamptz not null default now(),
  primary key (user_id, video_id),
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
  video_id text not null references public.videos(id),
  primary key (user_id, position),
  unique (user_id, video_id)
);

-- Create a profile automatically for each new sign-up
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

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.videos enable row level security;
alter table public.logs enable row level security;
alter table public.follows enable row level security;
alter table public.favourites enable row level security;

create policy "profiles are public"
  on public.profiles for select using (true);
create policy "users update own profile"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "anyone can read videos"
  on public.videos for select using (true);

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

-- Grants (tables aren't exposed to the API until granted)
grant select on public.profiles to anon, authenticated;
grant update (username) on public.profiles to authenticated;
grant all on public.profiles to service_role;

grant select on public.videos to anon, authenticated;
grant all on public.videos to service_role;

grant select on public.logs to anon, authenticated;
grant insert, update, delete on public.logs to authenticated;
grant all on public.logs to service_role;

grant select on public.follows to anon, authenticated;
grant insert, delete on public.follows to authenticated;
grant all on public.follows to service_role;

grant select on public.favourites to anon, authenticated;
grant insert, update, delete on public.favourites to authenticated;
grant all on public.favourites to service_role;

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  log_user_id uuid not null,
  log_video_id text not null,
  user_id uuid not null,
  parent_id uuid,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  constraint comments_user_id_profiles_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade,
  constraint comments_log_fkey
    foreign key (log_user_id, log_video_id)
    references public.logs(user_id, video_id) on delete cascade,
  constraint comments_id_log_key unique (id, log_user_id, log_video_id),
  -- A reply must belong to the same review as its parent
  constraint comments_parent_fkey
    foreign key (parent_id, log_user_id, log_video_id)
    references public.comments(id, log_user_id, log_video_id) on delete cascade
);

create index comments_log_idx
  on public.comments (log_user_id, log_video_id, created_at);

alter table public.comments enable row level security;

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

grant select on public.comments to anon, authenticated;
grant insert, delete on public.comments to authenticated;
grant all on public.comments to service_role;

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

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null,
  actor_id uuid not null,
  type text not null check (type in ('like', 'comment', 'reply', 'follow')),
  log_user_id uuid,
  log_video_id text,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  check (recipient_id <> actor_id),
  constraint notifications_recipient_fkey
    foreign key (recipient_id) references public.profiles(id) on delete cascade,
  constraint notifications_actor_fkey
    foreign key (actor_id) references public.profiles(id) on delete cascade,
  -- Deleting a review removes the notifications about it
  constraint notifications_log_fkey
    foreign key (log_user_id, log_video_id)
    references public.logs(user_id, video_id) on delete cascade
);

create index notifications_recipient_idx
  on public.notifications (recipient_id, created_at desc);

alter table public.notifications enable row level security;

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

grant select, delete on public.notifications to authenticated;
grant update (read) on public.notifications to authenticated;
grant all on public.notifications to service_role;

-- Someone likes your review (once per person per review, even if they unlike and re-like)
create function public.notify_on_like()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.notifications
    (recipient_id, actor_id, type, log_user_id, log_video_id)
  select new.log_user_id, new.user_id, 'like', new.log_user_id, new.log_video_id
  where not exists (
    select 1 from public.notifications n
    where n.recipient_id = new.log_user_id
      and n.actor_id = new.user_id
      and n.type = 'like'
      and n.log_user_id = new.log_user_id
      and n.log_video_id = new.log_video_id
  );
  return new;
end;
$$;

create trigger likes_notify
  after insert on public.likes
  for each row execute function public.notify_on_like();

-- Someone comments on your review, or replies to your comment
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
        (recipient_id, actor_id, type, log_user_id, log_video_id)
      values
        (parent_author, new.user_id, 'reply', new.log_user_id, new.log_video_id);
    end if;
  end if;

  -- The review's owner hears about it too, unless they were just notified as the parent
  if new.log_user_id <> new.user_id
     and new.log_user_id is distinct from parent_author then
    insert into public.notifications
      (recipient_id, actor_id, type, log_user_id, log_video_id)
    values
      (new.log_user_id, new.user_id, 'comment', new.log_user_id, new.log_video_id);
  end if;

  return new;
end;
$$;

create trigger comments_notify
  after insert on public.comments
  for each row execute function public.notify_on_comment();

-- Someone follows you (once per person, even if they unfollow and re-follow)
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