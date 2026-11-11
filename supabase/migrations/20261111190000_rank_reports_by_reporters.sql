-- Ranks the accounts the most people reported first. The most serious reason
-- reported only breaks ties, so an account seven people reported for spam
-- outranks one with a single report of sexual content.

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
    order by reporter_count desc, report_count desc, severity desc,
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
        a.reporter_count desc, a.report_count desc, a.severity desc,
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
