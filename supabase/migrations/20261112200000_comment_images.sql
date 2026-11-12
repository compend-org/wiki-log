-- ABOUTME: Lets comments on reviews and lists carry one uploaded image or GIF, from accounts 3+ days old and not blocked.
-- ABOUTME: Each new comment's images are sent to /api/moderate-comment-images, which removes flagged ones.

-- Whether every path is a file the browser names when uploading, inside
-- `folder`. Strict, so a stored path can never point outside that folder.
create function public.comment_image_paths_valid(paths text[], folder uuid)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    bool_and(p ~ ('^' || folder::text || '/[0-9a-f-]{36}\.(jpg|gif)$')),
    true
  )
  from unnest(paths) p;
$$;

alter table public.comments
  add column images text[] not null default '{}';
alter table public.comments drop constraint comments_body_check;
alter table public.comments
  add constraint comments_body_check
  check (
    char_length(body) <= 1000
    and (char_length(body) >= 1 or cardinality(images) >= 1)
  );
alter table public.comments
  add constraint comments_images_check
  check (
    cardinality(images) <= 1
    and public.comment_image_paths_valid(images, user_id)
  );

alter table public.list_comments
  add column images text[] not null default '{}';
alter table public.list_comments drop constraint list_comments_body_check;
alter table public.list_comments
  add constraint list_comments_body_check
  check (
    char_length(body) <= 1000
    and (char_length(body) >= 1 or cardinality(images) >= 1)
  );
alter table public.list_comments
  add constraint list_comments_images_check
  check (
    cardinality(images) <= 1
    and public.comment_image_paths_valid(images, user_id)
  );

-- A public bucket: 5 MB limit. Photos arrive as JPEG (the browser converts
-- them), GIFs as they are so they keep moving.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comment-images', 'comment-images', true, 5242880, array['image/jpeg', 'image/gif'])
on conflict (id) do nothing;

-- While the moderators have a comment removed, its files wait here instead,
-- at the same paths. Private and without policies: only the server reads it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('removed-comment-images', 'removed-comment-images', false, 5242880, array['image/jpeg', 'image/gif'])
on conflict (id) do nothing;

-- Whether one of the person's comments already uses this path, including a
-- comment the moderators removed
create function public.comment_image_in_use(p_path text, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.comments
    where user_id = p_user_id and images @> array[p_path]
  ) or exists (
    select 1 from public.list_comments
    where user_id = p_user_id and images @> array[p_path]
  );
$$;

revoke execute on function public.comment_image_in_use(text, uuid)
  from public, anon;

-- Files are served by their public URL. Through the API, people only see
-- their own folder, so nobody can list everyone's images.
create policy "users see their own comment image files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'comment-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Nobody can delete or overwrite their files, and nobody can upload to a path
-- a comment already uses: the image a comment shows stays the one the
-- automatic check looked at. Only the server deletes files.
create policy "users upload into their own comment image folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'comment-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not public.comment_image_in_use(name, (select auth.uid()))
  );

-- Comments also say how many images they have. The admin pages never load
-- images, so this is how a moderator knows a comment had some.
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
        'image_count', cardinality(c.images),
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
        'image_count', cardinality(c.images),
        'title', li.title,
        'list_id', li.id
      )
      from public.list_comments c
      join public.lists li on li.id = c.list_id
      where p_kind = 'list_comment' and c.id = p_id
    ),
    (
      select jsonb_build_object(
        'exists', true,
        'body', p.bio,
        'title', p.username,
        'href_profile', p.username
      )
      from public.profiles p
      where p_kind = 'profile' and p.id = p_id
    ),
    -- Reports outlive the post they're about
    jsonb_build_object('exists', false)
  );
$$;

-- When the automatic image check last finished with a comment's images, and
-- the scores it gave, kept for tuning its thresholds. Also when the retry job
-- last asked about it, so it takes turns between unchecked comments.
alter table public.comments
  add column images_checked_at timestamptz,
  add column image_scores jsonb,
  add column image_check_retried_at timestamptz;
alter table public.list_comments
  add column images_checked_at timestamptz,
  add column image_scores jsonb,
  add column image_check_retried_at timestamptz;

-- The retry job's queue: recent comments with images not checked yet
create index comments_unchecked_images_idx on public.comments (created_at)
  where images_checked_at is null and cardinality(images) > 0;
create index list_comments_unchecked_images_idx on public.list_comments (created_at)
  where images_checked_at is null and cardinality(images) > 0;

-- Accounts a moderator has stopped from attaching images, until lifted. Their
-- images already posted stay up, and they aren't told.
create table public.image_blocks (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  action_id uuid not null,
  created_at timestamptz not null default now()
);
alter table public.image_blocks enable row level security;
revoke all on public.image_blocks from anon, authenticated;
grant all on public.image_blocks to service_role;

-- Whether an account can attach images: 'allowed', 'new_account' (under 3
-- days old) or 'blocked' (by a moderator)
create function public.image_attach_status(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.image_blocks where user_id = p_user_id)
      then 'blocked'
    when exists (
      select 1 from public.profiles
      where id = p_user_id and created_at <= now() - interval '3 days'
    ) then 'allowed'
    else 'new_account'
  end;
$$;

-- The signed-in person's own status, for the comment form. Nobody can ask
-- about anyone else, so a block stays private.
create function public.my_image_attach_status()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select public.image_attach_status((select auth.uid()));
$$;

revoke execute on function public.image_attach_status(uuid)
  from public, anon, authenticated;
revoke execute on function public.my_image_attach_status() from public, anon;
grant execute on function public.my_image_attach_status() to authenticated;

-- Values sent from the site for the check's columns are ignored
-- Not security definer, so current_user is whoever is writing
create function public.keep_image_check_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.images_checked_at := null;
      new.image_scores := null;
      new.image_check_retried_at := null;
    else
      new.images_checked_at := old.images_checked_at;
      new.image_scores := old.image_scores;
      new.image_check_retried_at := old.image_check_retried_at;
    end if;
  end if;
  return new;
end;
$$;

create trigger comments_keep_image_check
  before insert or update on public.comments
  for each row execute function public.keep_image_check_columns();
create trigger list_comments_keep_image_check
  before insert or update on public.list_comments
  for each row execute function public.keep_image_check_columns();

-- New and blocked accounts can't attach images
create function public.check_comment_images()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if cardinality(new.images) > 0
     and (tg_op = 'INSERT' or new.images is distinct from old.images) then
    v_status := public.image_attach_status(new.user_id);
    if v_status = 'new_account' then
      raise exception 'Accounts can attach images once they''re 3 days old'
        using errcode = '42501';
    elsif v_status = 'blocked' then
      raise exception 'You can''t attach images to comments'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger comments_check_images
  before insert or update on public.comments
  for each row execute function public.check_comment_images();
create trigger list_comments_check_images
  before insert or update on public.list_comments
  for each row execute function public.check_comment_images();

-- The site is asked to check a comment's images. pg_net sends the request
-- after the transaction commits, so posting never waits on it. The site's
-- address and the shared secret live in Vault; without them nothing is sent.
create extension if not exists pg_net;

create function public.request_comment_image_check(p_table text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text := (
    select decrypted_secret from vault.decrypted_secrets
    where name = 'comment_image_check_url'
  );
  v_secret text := (
    select decrypted_secret from vault.decrypted_secrets
    where name = 'comment_image_check_secret'
  );
begin
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('table', p_table, 'id', p_id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Comment-Image-Check-Secret', v_secret
    ),
    timeout_milliseconds := 60000
  );
end;
$$;

create function public.request_comment_image_check_on_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.request_comment_image_check(tg_table_name, new.id);
  return null;
end;
$$;

create trigger comments_request_image_check
  after insert on public.comments
  for each row when (cardinality(new.images) > 0)
  execute function public.request_comment_image_check_on_insert();
create trigger list_comments_request_image_check
  after insert on public.list_comments
  for each row when (cardinality(new.images) > 0)
  execute function public.request_comment_image_check_on_insert();

-- Asks again about images whose check hasn't finished, such as when OpenAI was
-- down. The ones asked about longest ago go first, so a comment that keeps
-- failing doesn't hold up the rest. Gives up after a day; until then the
-- images stay up.
create function public.retry_comment_image_checks()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    with asked as (
      update public.comments set image_check_retried_at = now()
      where id in (
        select id from public.comments
        where images_checked_at is null and cardinality(images) > 0
          and removed_at is null
          and created_at between now() - interval '1 day'
                             and now() - interval '3 minutes'
        order by image_check_retried_at nulls first, created_at
        limit 20
      )
      returning id
    )
    select 'comments' as tbl, id from asked
  loop
    perform public.request_comment_image_check(r.tbl, r.id);
  end loop;

  for r in
    with asked as (
      update public.list_comments set image_check_retried_at = now()
      where id in (
        select id from public.list_comments
        where images_checked_at is null and cardinality(images) > 0
          and removed_at is null
          and created_at between now() - interval '1 day'
                             and now() - interval '3 minutes'
        order by image_check_retried_at nulls first, created_at
        limit 20
      )
      returning id
    )
    select 'list_comments' as tbl, id from asked
  loop
    perform public.request_comment_image_check(r.tbl, r.id);
  end loop;
end;
$$;

select cron.schedule(
  'retry-comment-image-checks',
  '*/5 * * * *',
  $$select public.retry_comment_image_checks()$$
);

-- An automatic report has no reporter
alter table public.reports alter column reporter_id drop not null;

-- Records the check of a comment whose images it flagged, removes the comment,
-- and files an open report saying why so a moderator can review it, all at
-- once. The author isn't notified. Says whether this call did it: false when
-- another check finished first. Only the site's server can call it.
create function public.auto_remove_comment(
  p_kind text,
  p_id uuid,
  p_reason text,
  p_details text,
  p_scores jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_kind not in ('comment', 'list_comment') then
    raise exception 'Unknown comment kind';
  end if;
  perform public.assert_moderation_reason(p_reason);

  if p_kind = 'comment' then
    update public.comments
    set images_checked_at = now(), image_scores = p_scores,
        removed_at = coalesce(removed_at, now())
    where id = p_id and images_checked_at is null;
  else
    update public.list_comments
    set images_checked_at = now(), image_scores = p_scores,
        removed_at = coalesce(removed_at, now())
    where id = p_id and images_checked_at is null;
  end if;
  if not found then
    return false;
  end if;

  insert into public.reports (reporter_id, target_type, target_id, reason, details)
  values (null, p_kind, p_id, p_reason, p_details);
  return true;
end;
$$;

revoke execute on function public.auto_remove_comment(text, uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.auto_remove_comment(text, uuid, text, text, jsonb)
  to service_role;
revoke execute on function public.request_comment_image_check(text, uuid)
  from public, anon, authenticated;
revoke execute on function public.retry_comment_image_checks()
  from public, anon, authenticated;

-- Automatic reports, which have no reporter, are listed too
create or replace function public.admin_report_account(p_user_id uuid)
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

  select jsonb_build_object(
    'id', p.id,
    'username', p.username,
    'bio', p.bio,
    'avatar_path', p.avatar_path,
    'joined_at', p.created_at,
    'is_admin', exists (
      select 1 from public.admins ad where ad.user_id = p.id
    ),
    'review_count', (
      select count(*) from public.logs l where l.user_id = p.id
    ),
    'list_count', (
      select count(*) from public.lists l where l.user_id = p.id
    ),
    'comment_count', (
      (select count(*) from public.comments c where c.user_id = p.id)
      + (select count(*) from public.list_comments c where c.user_id = p.id)
    ),
    'posts_last_day', (
      select count(*) from (
        select 1 from public.logs l
          where l.user_id = p.id and l.logged_at > now() - interval '1 day'
        union all
        select 1 from public.lists l
          where l.user_id = p.id and l.created_at > now() - interval '1 day'
        union all
        select 1 from public.comments c
          where c.user_id = p.id and c.created_at > now() - interval '1 day'
        union all
        select 1 from public.list_comments c
          where c.user_id = p.id and c.created_at > now() - interval '1 day'
      ) recent
    ),
    'posts_last_week', (
      select count(*) from (
        select 1 from public.logs l
          where l.user_id = p.id and l.logged_at > now() - interval '7 days'
        union all
        select 1 from public.lists l
          where l.user_id = p.id and l.created_at > now() - interval '7 days'
        union all
        select 1 from public.comments c
          where c.user_id = p.id and c.created_at > now() - interval '7 days'
        union all
        select 1 from public.list_comments c
          where c.user_id = p.id and c.created_at > now() - interval '7 days'
      ) recent
    ),
    'blocked_by_count', (
      select count(*) from public.blocks b where b.blocked_id = p.id
    ),
    'filed', (
      select jsonb_build_object(
        'total', count(*),
        'dismissed', count(*) filter (where r.status = 'dismissed'),
        'actioned', count(*) filter (where r.status = 'actioned')
      )
      from public.reports r
      where r.reporter_id = p.id
    ),
    'flagged', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kind', t.target_type,
        'id', t.target_id,
        'post', public.admin_post(t.target_type, t.target_id),
        'reports', t.reports
      ) order by t.open_count desc, t.report_count desc, t.latest desc)
      from (
        select
          r.target_type,
          r.target_id,
          count(*) filter (where r.status = 'open') as open_count,
          count(*) as report_count,
          max(r.created_at) as latest,
          jsonb_agg(jsonb_build_object(
            'id', r.id,
            'reason', r.reason,
            'details', r.details,
            'status', r.status,
            'at', r.created_at,
            'reporter_id', r.reporter_id,
            'reporter', reporter.username
          ) order by r.created_at desc) as reports
        from public.reports r
        left join public.profiles reporter on reporter.id = r.reporter_id
        where r.reported_user_id = p.id
        group by r.target_type, r.target_id
      ) t
    ), '[]'::jsonb),
    'activity', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kind', a.kind,
        'id', a.id,
        'flagged', exists (
          select 1 from public.reports r
          where r.target_type = a.kind and r.target_id = a.id
        ),
        'post', public.admin_post(a.kind, a.id)
      ) order by a.at desc)
      from (
        select * from (
          (
            select 'log' as kind, l.id, l.logged_at as at
            from public.logs l where l.user_id = p.id
            order by l.logged_at desc limit 100
          )
          union all
          (
            select 'list', l.id, l.created_at
            from public.lists l where l.user_id = p.id
            order by l.created_at desc limit 100
          )
          union all
          (
            select 'comment', c.id, c.created_at
            from public.comments c where c.user_id = p.id
            order by c.created_at desc limit 100
          )
          union all
          (
            select 'list_comment', c.id, c.created_at
            from public.list_comments c where c.user_id = p.id
            order by c.created_at desc limit 100
          )
        ) everything
        order by at desc
        limit 100
      ) a
    ), '[]'::jsonb)
  )
  into result
  from public.profiles p
  where p.id = p_user_id;

  return result;
end;
$$;


-- Moderators can stop an account attaching images, and lift that
alter table public.moderation_actions drop constraint moderation_actions_kind_check;
alter table public.moderation_actions add constraint moderation_actions_kind_check
  check (kind in (
    'warn', 'remove_post', 'restore_post', 'suspend', 'lift_suspension',
    'ban', 'unban', 'close_reports', 'reopen_reports',
    'block_images', 'unblock_images'
  ));

create function public.admin_block_images(
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
begin
  perform public.assert_site_admin();
  perform public.assert_moderation_reason(p_reason);
  perform public.assert_moderatable(p_user_id);
  if exists (select 1 from public.image_blocks where user_id = p_user_id) then
    raise exception 'That account already can''t add images';
  end if;

  insert into public.moderation_actions (id, admin_id, user_id, kind, reason, note)
  values (v_action, (select auth.uid()), p_user_id, 'block_images', p_reason, p_note);

  insert into public.image_blocks (user_id, action_id)
  values (p_user_id, v_action);
end;
$$;

create function public.admin_unblock_images(
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

  delete from public.image_blocks where user_id = p_user_id;
  if not found then
    raise exception 'That account can already add images';
  end if;

  insert into public.moderation_actions (admin_id, user_id, kind, note)
  values ((select auth.uid()), p_user_id, 'unblock_images', p_note);
end;
$$;

revoke execute on function public.admin_block_images(uuid, text, text) from public, anon;
revoke execute on function public.admin_unblock_images(uuid, text) from public, anon;
grant execute on function public.admin_block_images(uuid, text, text) to authenticated;
grant execute on function public.admin_unblock_images(uuid, text) to authenticated;

-- An account's moderation state also says since when it can't add images
create or replace function public.admin_account_moderation(p_user_id uuid)
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
    'images_blocked_at', (
      select created_at from public.image_blocks where user_id = p_user_id
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
