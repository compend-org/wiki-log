drop function if exists public.daily_picks(text);

-- Speeds up "the last 24 hours" here and the home feed
create index if not exists logs_logged_at_idx on public.logs (logged_at desc);

create function public.popular_picks()
returns table (
  kind text,
  item_id text,
  avg_rating numeric,
  n bigint
)
language sql
stable
set search_path = ''
as $$
  with rated as (
    -- each person's latest rating of each item within the last 24 hours
    select distinct on (l.user_id, l.item_id)
      l.item_id,
      l.rating
    from public.logs l
    where l.rating is not null
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
  best as (
    select 'popular'::text as kind, p.item_id, p.avg_rating, p.n
    from per_item p
    order by p.avg_rating desc, p.n desc, p.item_id
    limit 1
  ),
  worst as (
    select 'unpopular'::text as kind, p.item_id, p.avg_rating, p.n
    from per_item p
    where p.avg_rating < (select max(q.avg_rating) from per_item q)
    order by p.avg_rating asc, p.n desc, p.item_id
    limit 1
  )
  select * from best
  union all
  select * from worst;
$$;

grant execute on function public.popular_picks() to anon, authenticated;