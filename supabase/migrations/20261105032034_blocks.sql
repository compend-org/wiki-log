-- ABOUTME: Lets people block each other. While a block exists, neither person
-- ABOUTME: can follow, like, share, comment on or reply to the other.
create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

-- Blocking someone unfollows in both directions, drops their shares of your
-- posts, and clears the notifications they sent you
create function public.apply_block()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  delete from public.follows
  where (follower_id = new.blocker_id and following_id = new.blocked_id)
     or (follower_id = new.blocked_id and following_id = new.blocker_id);

  delete from public.shares s
  where s.user_id = new.blocked_id
    and (
      exists (
        select 1 from public.logs g
        where g.id = s.log_id and g.user_id = new.blocker_id
      )
      or exists (
        select 1 from public.lists l
        where l.id = s.list_id and l.user_id = new.blocker_id
      )
    );

  delete from public.notifications
  where recipient_id = new.blocker_id and actor_id = new.blocked_id;

  return new;
end;
$$;

create trigger blocks_apply
  after insert on public.blocks
  for each row execute function public.apply_block();

-- Stops a follow, like, share or comment between two people when either has
-- blocked the other. The other people involved are the owner of what is being
-- acted on and, for replies, the author of the parent comment.
create function public.prevent_blocked_interaction()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  actor uuid;
  others uuid[];
begin
  case tg_table_name
    when 'follows' then
      actor := new.follower_id;
      others := array[new.following_id];
    when 'likes' then
      actor := new.user_id;
      others := array[(select user_id from public.logs where id = new.log_id)];
    when 'comment_likes' then
      actor := new.user_id;
      others := array[
        (select user_id from public.comments where id = new.comment_id)
      ];
    when 'list_likes' then
      actor := new.user_id;
      others := array[(select user_id from public.lists where id = new.list_id)];
    when 'shares' then
      actor := new.user_id;
      others := array[
        (select user_id from public.logs where id = new.log_id),
        (select user_id from public.lists where id = new.list_id)
      ];
    when 'comments' then
      actor := new.user_id;
      others := array[
        (select user_id from public.logs where id = new.log_id),
        (select user_id from public.comments where id = new.parent_id)
      ];
    when 'list_comments' then
      actor := new.user_id;
      others := array[
        (select user_id from public.lists where id = new.list_id),
        (select user_id from public.list_comments where id = new.parent_id)
      ];
  end case;

  if exists (
    select 1 from public.blocks b
    where (b.blocker_id = actor and b.blocked_id = any(others))
       or (b.blocked_id = actor and b.blocker_id = any(others))
  ) then
    raise exception 'You can''t do that here.';
  end if;

  return new;
end;
$$;

create trigger follows_check_blocks
  before insert on public.follows
  for each row execute function public.prevent_blocked_interaction();
create trigger likes_check_blocks
  before insert on public.likes
  for each row execute function public.prevent_blocked_interaction();
create trigger comment_likes_check_blocks
  before insert on public.comment_likes
  for each row execute function public.prevent_blocked_interaction();
create trigger list_likes_check_blocks
  before insert on public.list_likes
  for each row execute function public.prevent_blocked_interaction();
create trigger shares_check_blocks
  before insert on public.shares
  for each row execute function public.prevent_blocked_interaction();
create trigger comments_check_blocks
  before insert on public.comments
  for each row execute function public.prevent_blocked_interaction();
create trigger list_comments_check_blocks
  before insert on public.list_comments
  for each row execute function public.prevent_blocked_interaction();

-- Row Level Security: only you can see, add or remove your own blocks, so
-- nobody can find out who has blocked them
alter table public.blocks enable row level security;

create policy "users see own blocks"
  on public.blocks for select
  using ((select auth.uid()) = blocker_id);
create policy "users block as themselves"
  on public.blocks for insert
  with check ((select auth.uid()) = blocker_id);
create policy "users unblock as themselves"
  on public.blocks for delete
  using ((select auth.uid()) = blocker_id);

grant select, insert, delete on public.blocks to authenticated;
grant all on public.blocks to service_role;
