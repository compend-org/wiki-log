-- The ranking counts likes by when they were given
alter table public.likes
  add column if not exists created_at timestamptz not null default now();
alter table public.list_likes
  add column if not exists created_at timestamptz not null default now();

create index if not exists likes_created_at_idx
  on public.likes (created_at desc);
create index if not exists list_likes_created_at_idx
  on public.list_likes (created_at desc);

create function public.trending_logs(
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
  where l.created_at > now() - make_interval(hours => p_hours)
  group by l.log_id
  order by count(*) desc, max(l.created_at) desc
  limit p_limit;
$$;

create function public.trending_lists(
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
  where l.created_at > now() - make_interval(hours => p_hours)
  group by l.list_id
  order by count(*) desc, max(l.created_at) desc
  limit p_limit;
$$;

grant execute on function public.trending_logs(int, int) to anon, authenticated;
grant execute on function public.trending_lists(int, int) to anon, authenticated;