-- A post marked keep_trending can stay in Trending however old it is, as long
-- as it keeps getting likes
alter table public.logs
  add column if not exists keep_trending boolean not null default false;

create or replace function public.trending_logs(
  p_hours int default 48,
  p_limit int default 31
)
returns table (row_id uuid, recent_likes bigint)
language sql
stable
set search_path = ''
as $$
  select l.log_id, count(*)
  from public.likes l
  join public.logs g on g.id = l.log_id
  where l.created_at > now() - make_interval(hours => p_hours)
    and (
      g.logged_at > now() - make_interval(hours => p_hours)
      or g.keep_trending
    )
  group by l.log_id
  order by count(*) desc, max(l.created_at) desc
  limit p_limit;
$$;