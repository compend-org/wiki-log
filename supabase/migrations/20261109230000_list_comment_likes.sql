-- ABOUTME: Likes on list comments, with the same rules as likes on review comments:
-- ABOUTME: not your own, not across a block, not while suspended, and gone on a ban.

create table public.list_comment_likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  list_comment_id uuid not null references public.list_comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, list_comment_id)
);

create index list_comment_likes_list_comment_idx
  on public.list_comment_likes (list_comment_id);

alter table public.list_comment_likes enable row level security;

create policy "list comment likes are public"
  on public.list_comment_likes for select using (true);

-- You can like anyone's list comment except your own
create policy "users like list comments as themselves"
  on public.list_comment_likes for insert
  with check (
    (select auth.uid()) = user_id
    and not exists (
      select 1 from public.list_comments c
      where c.id = list_comment_likes.list_comment_id
        and c.user_id = (select auth.uid())
    )
  );

create policy "users unlike list comments as themselves"
  on public.list_comment_likes for delete
  using ((select auth.uid()) = user_id);

grant select on public.list_comment_likes to anon, authenticated;
grant insert, delete on public.list_comment_likes to authenticated;
grant all on public.list_comment_likes to service_role;

create trigger list_comment_likes_restricted
  before insert on public.list_comment_likes
  for each row execute function public.prevent_restricted_activity();

-- Stops a follow, like, share or comment between two people when either has
-- blocked the other. The other people involved are the owner of what is being
-- acted on and, for replies, the author of the parent comment.
create or replace function public.prevent_blocked_interaction()
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
    when 'list_comment_likes' then
      actor := new.user_id;
      others := array[
        (select user_id from public.list_comments where id = new.list_comment_id)
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

create trigger list_comment_likes_check_blocks
  before insert on public.list_comment_likes
  for each row execute function public.prevent_blocked_interaction();

-- Bans an account without deleting it: hides the profile and everything they
-- posted, removes their likes, shares, pins and follows, and closes the open
-- reports about them as actioned. The site blocks their email and sign-in
-- separately. The account page as it was is kept in the record.
create or replace function public.admin_ban(
  p_user_id uuid,
  p_reason text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action uuid := gen_random_uuid();
  v_reports uuid[];
  v_snapshot jsonb;
begin
  perform public.assert_site_admin();
  perform public.assert_moderation_reason(p_reason);
  perform public.assert_moderatable(p_user_id);
  if exists (
    select 1 from public.profiles where id = p_user_id and banned_at is not null
  ) then
    raise exception 'That account is already banned';
  end if;

  v_snapshot := public.admin_report_account(p_user_id);

  with closed as (
    update public.reports set status = 'actioned'
    where reported_user_id = p_user_id and status = 'open'
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_reports from closed;

  insert into public.moderation_actions (
    id, admin_id, user_id, kind, reason, note, report_ids, snapshot
  ) values (
    v_action, (select auth.uid()), p_user_id, 'ban', p_reason, p_note,
    v_reports, v_snapshot
  );

  update public.profiles set banned_at = now() where id = p_user_id;

  update public.logs set removed_at = now(), removed_by_action = v_action
  where user_id = p_user_id and removed_at is null;
  update public.lists set removed_at = now(), removed_by_action = v_action
  where user_id = p_user_id and removed_at is null;
  update public.comments set removed_at = now(), removed_by_action = v_action
  where user_id = p_user_id and removed_at is null;
  update public.list_comments set removed_at = now(), removed_by_action = v_action
  where user_id = p_user_id and removed_at is null;

  delete from public.likes where user_id = p_user_id;
  delete from public.comment_likes where user_id = p_user_id;
  delete from public.list_comment_likes where user_id = p_user_id;
  delete from public.list_likes where user_id = p_user_id;
  delete from public.shares where user_id = p_user_id;
  delete from public.pins where user_id = p_user_id;
  delete from public.follows
  where follower_id = p_user_id or following_id = p_user_id;
  delete from public.notifications where actor_id = p_user_id;
  delete from public.account_restrictions where user_id = p_user_id;
end;
$$;

-- viewer_state also reports which of a page's list comments the viewer liked
drop function public.viewer_state(uuid[], uuid[], uuid[]);

create function public.viewer_state(
  p_log_ids uuid[],
  p_list_ids uuid[],
  p_comment_ids uuid[] default '{}',
  p_list_comment_ids uuid[] default '{}'
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'liked_logs', coalesce((
      select jsonb_agg(l.log_id)
      from public.likes l
      where l.user_id = (select auth.uid()) and l.log_id = any(p_log_ids)
    ), '[]'::jsonb),
    'shared_logs', coalesce((
      select jsonb_agg(s.log_id)
      from public.shares s
      where s.user_id = (select auth.uid()) and s.log_id = any(p_log_ids)
    ), '[]'::jsonb),
    'liked_lists', coalesce((
      select jsonb_agg(l.list_id)
      from public.list_likes l
      where l.user_id = (select auth.uid()) and l.list_id = any(p_list_ids)
    ), '[]'::jsonb),
    'shared_lists', coalesce((
      select jsonb_agg(s.list_id)
      from public.shares s
      where s.user_id = (select auth.uid()) and s.list_id = any(p_list_ids)
    ), '[]'::jsonb),
    'liked_comments', coalesce((
      select jsonb_agg(c.comment_id)
      from public.comment_likes c
      where c.user_id = (select auth.uid()) and c.comment_id = any(p_comment_ids)
    ), '[]'::jsonb),
    'liked_list_comments', coalesce((
      select jsonb_agg(c.list_comment_id)
      from public.list_comment_likes c
      where c.user_id = (select auth.uid())
        and c.list_comment_id = any(p_list_comment_ids)
    ), '[]'::jsonb),
    'blocked', coalesce((
      select jsonb_agg(b.blocked_id)
      from public.blocks b
      where b.blocker_id = (select auth.uid())
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.viewer_state(uuid[], uuid[], uuid[], uuid[])
  from public, anon;
grant execute on function public.viewer_state(uuid[], uuid[], uuid[], uuid[])
  to authenticated, service_role;
