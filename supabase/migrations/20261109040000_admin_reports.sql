-- ABOUTME: Lets site admins read and triage reports through the admin reports pages.
-- ABOUTME: Every function checks public.admins itself, so a non-admin gets nothing even if the pages fail to stop them.

-- Looking up everything one person wrote, here and when an account is deleted
create index if not exists comments_user_idx on public.comments (user_id);

-- Stops the calling function unless the signed-in person is an admin. Reads the
-- table directly rather than any cache, so removing an admin takes effect at once.
create function public.assert_site_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.admins where user_id = (select auth.uid())
  ) then
    raise exception 'Admins only' using errcode = '42501';
  end if;
end;
$$;

-- One reported or recent post in a single shape, whichever table it lives in.
-- A list's content is mostly its items, so their titles come along with it.
create function public.admin_post(p_kind text, p_id uuid)
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

-- The accounts with the most people reporting them, for the reports page. Counts
-- distinct reporters first, because one person filing ten reports says less
-- than ten people filing one each.
create function public.admin_report_queue(
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
      max(s.created_at) as last_report_at
    from shown s
    group by s.reported_user_id
    order by reporter_count desc, report_count desc, last_report_at desc
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
        a.reporter_count desc, a.report_count desc, a.last_report_at desc)
      from (
        select
          r.user_id,
          p.username,
          p.created_at as joined_at,
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

-- Everything about one account an admin needs to decide what to do with it.
-- Returns null when there's no such account.
create function public.admin_report_account(p_user_id uuid)
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
        join public.profiles reporter on reporter.id = r.reporter_id
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

-- Marks every report on one post as dismissed, actioned, or open again. A later
-- report from someone else still arrives as open.
create function public.admin_set_report_status(
  p_target_type text,
  p_target_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_site_admin();

  update public.reports
  set status = p_status
  where target_type = p_target_type and target_id = p_target_id;
end;
$$;

-- Helpers are only called from inside the functions above
revoke execute on function public.assert_site_admin() from public, anon, authenticated;
revoke execute on function public.admin_post(text, uuid) from public, anon, authenticated;

-- Signed-in people may call these, and the check inside lets through only admins
revoke execute on function public.admin_report_queue(boolean, integer) from public, anon;
revoke execute on function public.admin_report_account(uuid) from public, anon;
revoke execute on function public.admin_set_report_status(text, uuid, text) from public, anon;
grant execute on function public.admin_report_queue(boolean, integer) to authenticated;
grant execute on function public.admin_report_account(uuid) to authenticated;
grant execute on function public.admin_set_report_status(text, uuid, text) to authenticated;
