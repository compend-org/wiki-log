-- ABOUTME: Moderation beyond reports: removing posts, warnings, suspensions and bans, with a permanent record of every action.
-- ABOUTME: Removed posts stay visible to their authors, banned accounts stay in the database, and people are told what happened.

-- What moderators did and why. Rows are never changed or deleted, and there
-- are no foreign keys, so the record outlives the posts and accounts in it.
create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null,
  -- The account acted on
  user_id uuid not null,
  kind text not null check (kind in (
    'warn', 'remove_post', 'restore_post', 'suspend', 'lift_suspension',
    'ban', 'unban', 'close_reports', 'reopen_reports'
  )),
  target_type text
    check (target_type in ('log', 'list', 'comment', 'list_comment')),
  target_id uuid,
  reason text
    check (reason in ('spam', 'harassment', 'hate', 'sexual', 'other')),
  -- Only admins see the note
  note text check (note is null or char_length(note) <= 1000),
  report_status text check (report_status in ('open', 'actioned', 'dismissed')),
  suspended_until timestamptz,
  report_ids uuid[] not null default '{}',
  -- The post, or for a ban the whole account page, as it was at the time
  snapshot jsonb,
  created_at timestamptz not null default now()
);

create index moderation_actions_user_idx
  on public.moderation_actions (user_id, created_at desc);

create function public.keep_moderation_actions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Moderation actions cannot be changed or deleted';
end;
$$;

create trigger moderation_actions_append_only
  before update or delete on public.moderation_actions
  for each row execute function public.keep_moderation_actions();

-- No policies: only the admin functions below read and write it
alter table public.moderation_actions enable row level security;
revoke all on public.moderation_actions from anon, authenticated;
grant select, insert on public.moderation_actions to service_role;

-- People who can't post, comment, like, share or follow until a date. Kept
-- private, unlike a ban, which shows by the account disappearing.
create table public.account_restrictions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  suspended_until timestamptz not null,
  action_id uuid not null
);

alter table public.account_restrictions enable row level security;
revoke all on public.account_restrictions from anon, authenticated;
grant all on public.account_restrictions to service_role;

-- So their own profile can tell them they're suspended and until when
grant select on public.account_restrictions to authenticated;
create policy "people can see their own suspension"
  on public.account_restrictions for select to authenticated
  using ((select auth.uid()) = user_id);

alter table public.profiles add column banned_at timestamptz;
alter table public.logs
  add column removed_at timestamptz,
  add column removed_by_action uuid;
alter table public.lists
  add column removed_at timestamptz,
  add column removed_by_action uuid;
alter table public.comments
  add column removed_at timestamptz,
  add column removed_by_action uuid;
alter table public.list_comments
  add column removed_at timestamptz,
  add column removed_by_action uuid;

-- Only moderators can remove a post or ban an account; values sent from the
-- site are ignored
create function public.keep_removal_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.removed_at := null;
      new.removed_by_action := null;
    else
      new.removed_at := old.removed_at;
      new.removed_by_action := old.removed_by_action;
    end if;
  end if;
  return new;
end;
$$;

create trigger logs_keep_removal
  before insert or update on public.logs
  for each row execute function public.keep_removal_columns();
create trigger lists_keep_removal
  before insert or update on public.lists
  for each row execute function public.keep_removal_columns();
create trigger comments_keep_removal
  before insert or update on public.comments
  for each row execute function public.keep_removal_columns();
create trigger list_comments_keep_removal
  before insert or update on public.list_comments
  for each row execute function public.keep_removal_columns();

create function public.keep_banned_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.banned_at := null;
    else
      new.banned_at := old.banned_at;
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_keep_banned_at
  before insert or update on public.profiles
  for each row execute function public.keep_banned_at();

-- Removed posts are hidden from everyone but their author, and banned
-- accounts from everyone but themselves. A list's items go with the list.
drop policy "logs are public" on public.logs;
create policy "logs are public unless removed" on public.logs
  for select using (removed_at is null or (select auth.uid()) = user_id);

drop policy "lists are public" on public.lists;
create policy "lists are public unless removed" on public.lists
  for select using (removed_at is null or (select auth.uid()) = user_id);

drop policy "list items are public" on public.list_items;
create policy "list items are public unless their list is removed"
  on public.list_items
  for select using (
    exists (select 1 from public.lists l where l.id = list_items.list_id)
  );

drop policy "comments are public" on public.comments;
create policy "comments are public unless removed" on public.comments
  for select using (removed_at is null or (select auth.uid()) = user_id);

drop policy "list comments are public" on public.list_comments;
create policy "list comments are public unless removed" on public.list_comments
  for select using (removed_at is null or (select auth.uid()) = user_id);

drop policy "profiles are public" on public.profiles;
create policy "profiles are public unless banned" on public.profiles
  for select using (banned_at is null or (select auth.uid()) = id);

-- Stops suspended and banned people from posting, commenting, liking,
-- sharing, following or changing their profile. Reporting and blocking stay
-- open to them.
create function public.prevent_restricted_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is not null and (
    exists (
      select 1 from public.profiles
      where id = v_user and banned_at is not null
    )
    or exists (
      select 1 from public.account_restrictions
      where user_id = v_user and suspended_until > now()
    )
  ) then
    raise exception 'Your account is suspended' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger logs_restricted
  before insert or update on public.logs
  for each row execute function public.prevent_restricted_activity();
create trigger lists_restricted
  before insert or update on public.lists
  for each row execute function public.prevent_restricted_activity();
create trigger list_items_restricted
  before insert or update on public.list_items
  for each row execute function public.prevent_restricted_activity();
create trigger comments_restricted
  before insert on public.comments
  for each row execute function public.prevent_restricted_activity();
create trigger list_comments_restricted
  before insert on public.list_comments
  for each row execute function public.prevent_restricted_activity();
create trigger likes_restricted
  before insert on public.likes
  for each row execute function public.prevent_restricted_activity();
create trigger comment_likes_restricted
  before insert on public.comment_likes
  for each row execute function public.prevent_restricted_activity();
create trigger list_likes_restricted
  before insert on public.list_likes
  for each row execute function public.prevent_restricted_activity();
create trigger shares_restricted
  before insert on public.shares
  for each row execute function public.prevent_restricted_activity();
create trigger follows_restricted
  before insert on public.follows
  for each row execute function public.prevent_restricted_activity();
create trigger pins_restricted
  before insert on public.pins
  for each row execute function public.prevent_restricted_activity();
create trigger profiles_restricted
  before update on public.profiles
  for each row execute function public.prevent_restricted_activity();

-- Moderators' messages arrive as notifications with no actor
alter table public.notifications alter column actor_id drop not null;
alter table public.notifications add column body text;
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'like', 'comment', 'reply', 'follow', 'list_like', 'list_comment',
    'list_reply', 'share', 'list_share', 'moderation'
  ));

-- The daily picks are computed by a cron job that skips row-level security,
-- so removed reviews are left out here
create or replace function public.compute_popular_picks()
returns table(kind text, item_id text, avg_rating numeric, n bigint)
language sql
set search_path = ''
as $$
  with rated as (
    -- each person's latest rating of each item within the last 24 hours
    select distinct on (l.user_id, l.item_id)
      l.item_id,
      l.rating
    from public.logs l
    where l.rating is not null
      and l.removed_at is null
      and l.logged_at > now() - interval '24 hours'
    order by l.user_id, l.item_id, l.logged_at desc
  ),
  per_item as (
    select r.item_id,
           round(avg(r.rating), 2) as avg_rating,
           count(*) as n
    from rated r
    group by r.item_id
  ),
  -- random one of the 5 best-rated items
  best as (
    select 'popular'::text as kind, t.item_id, t.avg_rating, t.n
    from (
      select * from per_item p
      order by p.avg_rating desc, p.n desc, p.item_id
      limit 5
    ) t
    order by random()
    limit 1
  ),
  -- random one of the 5 worst-rated items, always rated strictly lower
  -- than the popular pick so the two cards never show the same thing
  worst as (
    select 'unpopular'::text as kind, t.item_id, t.avg_rating, t.n
    from (
      select * from per_item p
      where p.avg_rating < (select b.avg_rating from best b)
      order by p.avg_rating asc, p.n desc, p.item_id
      limit 5
    ) t
    order by random()
    limit 1
  )
  select * from best
  union all
  select * from worst;
$$;

-- Who wrote a post, whichever table it lives in
create function public.post_author(p_kind text, p_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case p_kind
    when 'log' then (select user_id from public.logs where id = p_id)
    when 'list' then (select user_id from public.lists where id = p_id)
    when 'comment' then (select user_id from public.comments where id = p_id)
    when 'list_comment' then (select user_id from public.list_comments where id = p_id)
  end;
$$;

-- Removes a post on behalf of a moderation action, or restores it when the
-- action is null. Says whether anything changed.
create function public.set_post_removal(
  p_kind text,
  p_id uuid,
  p_action uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table text := case p_kind
    when 'log' then 'logs'
    when 'list' then 'lists'
    when 'comment' then 'comments'
    when 'list_comment' then 'list_comments'
  end;
  v_count integer;
begin
  if v_table is null then
    raise exception 'Unknown post kind';
  end if;

  if p_action is null then
    execute format(
      'update public.%I set removed_at = null, removed_by_action = null
       where id = $1 and removed_at is not null',
      v_table
    ) using p_id;
  else
    execute format(
      'update public.%I set removed_at = now(), removed_by_action = $2
       where id = $1 and removed_at is null',
      v_table
    ) using p_id, p_action;
  end if;

  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

-- How a report reason reads in a message to the person
create function public.moderation_reason_text(p_reason text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_reason
    when 'spam' then 'spam'
    when 'harassment' then 'harassment'
    when 'hate' then 'hateful content'
    when 'sexual' then 'sexual content'
    else 'breaking the site''s rules'
  end;
$$;

create function public.assert_moderation_reason(p_reason text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_reason is null
    or p_reason not in ('spam', 'harassment', 'hate', 'sexual', 'other') then
    raise exception 'Unknown reason';
  end if;
end;
$$;

-- Tells someone what the moderators did, linking to the post when there is one
create function public.notify_moderation(
  p_user_id uuid,
  p_body text,
  p_kind text default null,
  p_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_log uuid;
  v_list uuid;
begin
  case p_kind
    when 'log' then v_log := p_id;
    when 'list' then v_list := p_id;
    when 'comment' then
      select log_id into v_log from public.comments where id = p_id;
    when 'list_comment' then
      select list_id into v_list from public.list_comments where id = p_id;
    else null;
  end case;

  insert into public.notifications (recipient_id, type, body, log_id, list_id)
  values (p_user_id, 'moderation', p_body, v_log, v_list);
end;
$$;

-- Stops the calling function when the account is an admin's or doesn't exist
create function public.assert_moderatable(p_user_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'No such account';
  end if;
  if exists (select 1 from public.admins where user_id = p_user_id) then
    raise exception 'Admins can''t be moderated';
  end if;
end;
$$;

-- Removes one post, hiding it from everyone but its author, and closes its
-- open reports as actioned
create function public.admin_remove_post(
  p_kind text,
  p_id uuid,
  p_reason text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author uuid;
  v_action uuid := gen_random_uuid();
  v_reports uuid[];
  v_noun text := case when p_kind = 'log' then 'review' when p_kind = 'list' then 'list' else 'comment' end;
begin
  perform public.assert_site_admin();
  perform public.assert_moderation_reason(p_reason);

  v_author := public.post_author(p_kind, p_id);
  if v_author is null then
    raise exception 'That post no longer exists';
  end if;

  with closed as (
    update public.reports set status = 'actioned'
    where target_type = p_kind and target_id = p_id and status = 'open'
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_reports from closed;

  insert into public.moderation_actions (
    id, admin_id, user_id, kind, target_type, target_id, reason, note,
    report_ids, snapshot
  ) values (
    v_action, (select auth.uid()), v_author, 'remove_post', p_kind, p_id,
    p_reason, p_note, v_reports, public.admin_post(p_kind, p_id)
  );

  if not public.set_post_removal(p_kind, p_id, v_action) then
    raise exception 'That post is already removed';
  end if;

  perform public.notify_moderation(
    v_author,
    format('One of your %ss was removed for %s.', v_noun, public.moderation_reason_text(p_reason)),
    p_kind, p_id
  );
end;
$$;

create function public.admin_restore_post(
  p_kind text,
  p_id uuid,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author uuid;
  v_noun text := case when p_kind = 'log' then 'review' when p_kind = 'list' then 'list' else 'comment' end;
begin
  perform public.assert_site_admin();

  v_author := public.post_author(p_kind, p_id);
  if v_author is null then
    raise exception 'That post no longer exists';
  end if;
  -- A banned account's posts stay hidden until the ban is lifted
  if exists (select 1 from public.profiles where id = v_author and banned_at is not null) then
    raise exception 'Lift the ban before restoring their posts';
  end if;

  insert into public.moderation_actions (
    admin_id, user_id, kind, target_type, target_id, note
  ) values (
    (select auth.uid()), v_author, 'restore_post', p_kind, p_id, p_note
  );

  if not public.set_post_removal(p_kind, p_id, null) then
    raise exception 'That post isn''t removed';
  end if;

  perform public.notify_moderation(
    v_author,
    format('Your %s that was removed has been restored.', v_noun),
    p_kind, p_id
  );
end;
$$;

create function public.admin_warn(
  p_user_id uuid,
  p_reason text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_site_admin();
  perform public.assert_moderation_reason(p_reason);
  perform public.assert_moderatable(p_user_id);

  insert into public.moderation_actions (admin_id, user_id, kind, reason, note)
  values ((select auth.uid()), p_user_id, 'warn', p_reason, p_note);

  perform public.notify_moderation(
    p_user_id,
    format(
      'The moderators have warned you about %s. Further problems can lead to a suspension or a ban.',
      public.moderation_reason_text(p_reason)
    )
  );
end;
$$;

-- Stops someone posting, commenting, liking, sharing and following for a
-- number of days. Suspending again replaces the end date.
create function public.admin_suspend(
  p_user_id uuid,
  p_days integer,
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
  v_until timestamptz := now() + make_interval(days => p_days);
begin
  perform public.assert_site_admin();
  perform public.assert_moderation_reason(p_reason);
  perform public.assert_moderatable(p_user_id);
  if p_days is null or p_days not between 1 and 365 then
    raise exception 'A suspension lasts 1 to 365 days';
  end if;

  insert into public.moderation_actions (
    id, admin_id, user_id, kind, reason, note, suspended_until
  ) values (
    v_action, (select auth.uid()), p_user_id, 'suspend', p_reason, p_note,
    v_until
  );

  insert into public.account_restrictions (user_id, suspended_until, action_id)
  values (p_user_id, v_until, v_action)
  on conflict (user_id) do update
  set suspended_until = excluded.suspended_until,
      action_id = excluded.action_id;

  perform public.notify_moderation(
    p_user_id,
    format(
      'Your account is suspended until %s for %s. Until then you can''t post, comment, like, share or follow.',
      to_char(v_until at time zone 'UTC', 'FMMonth FMDD, YYYY'),
      public.moderation_reason_text(p_reason)
    )
  );
end;
$$;

create function public.admin_lift_suspension(
  p_user_id uuid,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_site_admin();

  delete from public.account_restrictions
  where user_id = p_user_id and suspended_until > now();
  if not found then
    raise exception 'That account isn''t suspended';
  end if;

  insert into public.moderation_actions (admin_id, user_id, kind, note)
  values ((select auth.uid()), p_user_id, 'lift_suspension', p_note);

  perform public.notify_moderation(p_user_id, 'Your suspension has been lifted.');
end;
$$;

-- Bans an account without deleting it: hides the profile and everything they
-- posted, removes their likes, shares, pins and follows, and closes the open
-- reports about them as actioned. The site blocks their email and sign-in
-- separately. The account page as it was is kept in the record.
create function public.admin_ban(
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
  delete from public.list_likes where user_id = p_user_id;
  delete from public.shares where user_id = p_user_id;
  delete from public.pins where user_id = p_user_id;
  delete from public.follows
  where follower_id = p_user_id or following_id = p_user_id;
  delete from public.notifications where actor_id = p_user_id;
  delete from public.account_restrictions where user_id = p_user_id;
end;
$$;

-- Lifts a ban and brings back the posts it hid. Posts removed one by one stay
-- removed, and deleted likes, shares, pins and follows don't come back.
create function public.admin_unban(
  p_user_id uuid,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bans uuid[];
begin
  perform public.assert_site_admin();

  update public.profiles set banned_at = null
  where id = p_user_id and banned_at is not null;
  if not found then
    raise exception 'That account isn''t banned';
  end if;

  select coalesce(array_agg(id), '{}') into v_bans
  from public.moderation_actions
  where user_id = p_user_id and kind = 'ban';

  insert into public.moderation_actions (admin_id, user_id, kind, note)
  values ((select auth.uid()), p_user_id, 'unban', p_note);

  update public.logs set removed_at = null, removed_by_action = null
  where user_id = p_user_id and removed_by_action = any (v_bans);
  update public.lists set removed_at = null, removed_by_action = null
  where user_id = p_user_id and removed_by_action = any (v_bans);
  update public.comments set removed_at = null, removed_by_action = null
  where user_id = p_user_id and removed_by_action = any (v_bans);
  update public.list_comments set removed_at = null, removed_by_action = null
  where user_id = p_user_id and removed_by_action = any (v_bans);

  perform public.notify_moderation(p_user_id, 'Your account has been restored.');
end;
$$;

-- An account's moderation state and history, for its admin page
create function public.admin_account_moderation(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_site_admin();

  return jsonb_build_object(
    'banned_at', (select banned_at from public.profiles where id = p_user_id),
    'suspended_until', (
      select suspended_until from public.account_restrictions
      where user_id = p_user_id and suspended_until > now()
    ),
    'actions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'kind', a.kind,
        'at', a.created_at,
        'admin', p.username,
        'reason', a.reason,
        'note', a.note,
        'target_type', a.target_type,
        'target_id', a.target_id,
        'report_status', a.report_status,
        'report_count', cardinality(a.report_ids),
        'suspended_until', a.suspended_until
      ) order by a.created_at desc)
      from (
        select * from public.moderation_actions
        where user_id = p_user_id
        order by created_at desc
        limit 100
      ) a
      left join public.profiles p on p.id = a.admin_id
    ), '[]'::jsonb)
  );
end;
$$;

-- Every banned account, newest ban first, whether or not anyone reported it,
-- so a ban can always be found and lifted
create function public.admin_banned_accounts()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_site_admin();

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', p.id,
      'username', p.username,
      'banned_at', p.banned_at,
      'reason', (
        select a.reason from public.moderation_actions a
        where a.user_id = p.id and a.kind = 'ban'
        order by a.created_at desc
        limit 1
      )
    ) order by p.banned_at desc)
    from public.profiles p
    where p.banned_at is not null
  ), '[]'::jsonb);
end;
$$;

-- Posts now say whether and when they were removed
create or replace function public.admin_post(p_kind text, p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'exists', true,
        'removed_at', l.removed_at,
        'at', l.logged_at,
        'body', l.review,
        'rating', l.rating,
        'item_id', l.item_id,
        'title', i.title,
        'href_log', jsonb_build_object('username', p.username, 'id', l.id)
      )
      from public.logs l
      join public.profiles p on p.id = l.user_id
      left join public.items i on i.id = l.item_id
      where p_kind = 'log' and l.id = p_id
    ),
    (
      select jsonb_build_object(
        'exists', true,
        'removed_at', li.removed_at,
        'at', li.created_at,
        'body', li.description,
        'title', li.title,
        'list_id', li.id,
        'item_count', (
          select count(*) from public.list_items x where x.list_id = li.id
        ),
        'item_titles', coalesce((
          select jsonb_agg(s.title order by s.position)
          from (
            select i.title, x.position
            from public.list_items x
            join public.items i on i.id = x.item_id
            where x.list_id = li.id
            order by x.position
            limit 40
          ) s
        ), '[]'::jsonb)
      )
      from public.lists li
      where p_kind = 'list' and li.id = p_id
    ),
    (
      select jsonb_build_object(
        'exists', true,
        'removed_at', c.removed_at,
        'at', c.created_at,
        'body', c.body,
        'item_id', l.item_id,
        'title', i.title,
        'href_log', jsonb_build_object('username', p.username, 'id', l.id)
      )
      from public.comments c
      join public.logs l on l.id = c.log_id
      join public.profiles p on p.id = l.user_id
      left join public.items i on i.id = l.item_id
      where p_kind = 'comment' and c.id = p_id
    ),
    (
      select jsonb_build_object(
        'exists', true,
        'removed_at', c.removed_at,
        'at', c.created_at,
        'body', c.body,
        'title', li.title,
        'list_id', li.id
      )
      from public.list_comments c
      join public.lists li on li.id = c.list_id
      where p_kind = 'list_comment' and c.id = p_id
    ),
    -- Reports outlive the post they're about
    jsonb_build_object('exists', false)
  );
$$;

-- Ranks by the most serious reason reported first, so one report of sexual
-- content outranks a pile of spam reports
create or replace function public.admin_report_queue(
  p_include_handled boolean default false,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  perform public.assert_site_admin();

  with shown as (
    select r.*
    from public.reports r
    where p_include_handled or r.status = 'open'
  ),
  ranked as (
    select
      s.reported_user_id as user_id,
      count(*) as report_count,
      count(distinct s.reporter_id) as reporter_count,
      count(distinct (s.target_type, s.target_id)) as flagged_post_count,
      max(case s.reason
        when 'sexual' then 5
        when 'hate' then 4
        when 'harassment' then 3
        when 'spam' then 2
        else 1
      end) as severity,
      max(s.created_at) as last_report_at
    from shown s
    group by s.reported_user_id
    order by severity desc, reporter_count desc, report_count desc,
      last_report_at desc
    limit p_limit
  )
  select jsonb_build_object(
    'open_reports', (
      select count(*) from public.reports where status = 'open'
    ),
    'reports_last_day', (
      select count(*) from public.reports
      where created_at > now() - interval '1 day'
    ),
    'account_count', (select count(distinct reported_user_id) from shown),
    'accounts', coalesce((
      select jsonb_agg(row_to_json(a) order by
        a.severity desc, a.reporter_count desc, a.report_count desc,
        a.last_report_at desc)
      from (
        select
          r.user_id,
          p.username,
          p.created_at as joined_at,
          p.banned_at,
          r.severity,
          r.report_count,
          r.reporter_count,
          r.flagged_post_count,
          -- From every report on the account, whatever the filter, so an early
          -- report still shows once it has been handled
          (
            select min(fr.created_at) from public.reports fr
            where fr.reported_user_id = r.user_id
          ) as first_report_at,
          r.last_report_at,
          exists (
            select 1 from public.admins ad where ad.user_id = r.user_id
          ) as is_admin,
          (
            select jsonb_object_agg(x.reason, x.n)
            from (
              select s.reason, count(*) as n
              from shown s
              where s.reported_user_id = r.user_id
              group by s.reason
            ) x
          ) as reasons,
          counts.review_count,
          counts.list_count,
          counts.comment_count,
          greatest(
            counts.last_log_at, counts.last_list_at,
            counts.last_comment_at, counts.last_list_comment_at
          ) as last_active_at,
          (
            select jsonb_agg(jsonb_build_object(
              'kind', t.target_type,
              'id', t.target_id,
              'report_count', t.n,
              'note', t.note,
              'post', public.admin_post(t.target_type, t.target_id)
            ) order by t.n desc, t.latest desc)
            from (
              select
                s.target_type,
                s.target_id,
                count(*) as n,
                max(s.created_at) as latest,
                max(s.details) as note
              from shown s
              where s.reported_user_id = r.user_id
              group by s.target_type, s.target_id
              order by n desc, latest desc
              limit 3
            ) t
          ) as top_posts
        from ranked r
        join public.profiles p on p.id = r.user_id
        cross join lateral (
          select
            (select count(*) from public.logs l where l.user_id = r.user_id)
              as review_count,
            (select count(*) from public.lists l where l.user_id = r.user_id)
              as list_count,
            (select count(*) from public.comments c where c.user_id = r.user_id)
              + (select count(*) from public.list_comments c where c.user_id = r.user_id)
              as comment_count,
            (select max(l.logged_at) from public.logs l where l.user_id = r.user_id)
              as last_log_at,
            (select max(l.created_at) from public.lists l where l.user_id = r.user_id)
              as last_list_at,
            (select max(c.created_at) from public.comments c where c.user_id = r.user_id)
              as last_comment_at,
            (select max(c.created_at) from public.list_comments c where c.user_id = r.user_id)
              as last_list_comment_at
        ) counts
      ) a
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

-- Marks every report on one post as dismissed, actioned, or open again, and
-- records the change
create or replace function public.admin_set_report_status(
  p_target_type text,
  p_target_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reports uuid[];
  v_user uuid;
begin
  perform public.assert_site_admin();

  with changed as (
    update public.reports
    set status = p_status
    where target_type = p_target_type
      and target_id = p_target_id
      and status <> p_status
    returning id, reported_user_id
  )
  select coalesce(array_agg(id), '{}'), max(reported_user_id::text)::uuid
  into v_reports, v_user
  from changed;

  if cardinality(v_reports) > 0 then
    insert into public.moderation_actions (
      admin_id, user_id, kind, target_type, target_id, report_status, report_ids
    ) values (
      (select auth.uid()), v_user,
      case when p_status = 'open' then 'reopen_reports' else 'close_reports' end,
      p_target_type, p_target_id, p_status, v_reports
    );
  end if;
end;
$$;

-- Marks an account's open reports as actioned or dismissed. Only reports filed
-- up to p_reported_before are closed, so one that arrives while the admin is
-- looking at the queue stays open.
create function public.admin_set_account_report_status(
  p_user_id uuid,
  p_status text,
  p_reported_before timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reports uuid[];
begin
  perform public.assert_site_admin();

  if p_status not in ('actioned', 'dismissed') then
    raise exception 'Unknown report status';
  end if;

  with closed as (
    update public.reports
    set status = p_status
    where reported_user_id = p_user_id
      and status = 'open'
      and created_at <= p_reported_before
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_reports from closed;

  if cardinality(v_reports) > 0 then
    insert into public.moderation_actions (
      admin_id, user_id, kind, report_status, report_ids
    ) values (
      (select auth.uid()), p_user_id, 'close_reports', p_status, v_reports
    );
  end if;
end;
$$;

-- Fills in who is being reported, and turns a repeat report of a post whose
-- report was closed into a fresh open report
create or replace function public.fill_report()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  -- Checked here because reopening a closed report below skips the insert
  -- policy. Calls without a signed-in user (the database itself, the service
  -- role) are trusted.
  if (select auth.uid()) is not null and new.reporter_id is distinct from (select auth.uid()) then
    raise exception 'You can only report as yourself' using errcode = '42501';
  end if;

  new.reported_user_id := public.post_author(new.target_type, new.target_id);

  if new.reported_user_id is null then
    raise exception 'That post no longer exists';
  end if;
  if new.reported_user_id = new.reporter_id then
    raise exception 'You cannot report your own post';
  end if;

  -- One report per person per post: reopen their closed one instead of
  -- inserting a second
  update public.reports
  set status = 'open',
      reason = new.reason,
      details = new.details,
      created_at = now()
  where reporter_id = new.reporter_id
    and target_type = new.target_type
    and target_id = new.target_id
    and status <> 'open';
  if found then
    return null;
  end if;

  return new;
end;
$$;

-- Helpers are only called from inside other functions
revoke execute on function public.post_author(text, uuid) from public, anon, authenticated;
revoke execute on function public.set_post_removal(text, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.notify_moderation(uuid, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.assert_moderatable(uuid) from public, anon, authenticated;
revoke execute on function public.assert_moderation_reason(text) from public, anon, authenticated;
revoke execute on function public.moderation_reason_text(text) from public, anon, authenticated;

-- Signed-in people may call these, and the check inside lets through only admins
revoke execute on function public.admin_remove_post(text, uuid, text, text) from public, anon;
revoke execute on function public.admin_restore_post(text, uuid, text) from public, anon;
revoke execute on function public.admin_warn(uuid, text, text) from public, anon;
revoke execute on function public.admin_suspend(uuid, integer, text, text) from public, anon;
revoke execute on function public.admin_lift_suspension(uuid, text) from public, anon;
revoke execute on function public.admin_ban(uuid, text, text) from public, anon;
revoke execute on function public.admin_unban(uuid, text) from public, anon;
revoke execute on function public.admin_account_moderation(uuid) from public, anon;
revoke execute on function public.admin_banned_accounts() from public, anon;
revoke execute on function public.admin_set_account_report_status(uuid, text, timestamptz) from public, anon;
grant execute on function public.admin_remove_post(text, uuid, text, text) to authenticated;
grant execute on function public.admin_restore_post(text, uuid, text) to authenticated;
grant execute on function public.admin_warn(uuid, text, text) to authenticated;
grant execute on function public.admin_suspend(uuid, integer, text, text) to authenticated;
grant execute on function public.admin_lift_suspension(uuid, text) to authenticated;
grant execute on function public.admin_ban(uuid, text, text) to authenticated;
grant execute on function public.admin_unban(uuid, text) to authenticated;
grant execute on function public.admin_account_moderation(uuid) to authenticated;
grant execute on function public.admin_banned_accounts() to authenticated;
grant execute on function public.admin_set_account_report_status(uuid, text, timestamptz) to authenticated;
