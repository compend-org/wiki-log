-- Trending only considers posts made inside the window, ranked by the likes
-- they got inside it
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
    and g.logged_at > now() - make_interval(hours => p_hours)
  group by l.log_id
  order by count(*) desc, max(l.created_at) desc
  limit p_limit;
$$;

create or replace function public.trending_lists(
  p_hours int default 48,
  p_limit int default 31
)
returns table (row_id uuid, recent_likes bigint)
language sql
stable
set search_path = ''
as $$
  select l.list_id, count(*)
  from public.list_likes l
  join public.lists s on s.id = l.list_id
  where l.created_at > now() - make_interval(hours => p_hours)
    and s.created_at > now() - make_interval(hours => p_hours)
  group by l.list_id
  order by count(*) desc, max(l.created_at) desc
  limit p_limit;
$$;