create or replace function public.popular_picks()
returns table (
  kind text,
  item_id text,
  avg_rating numeric,
  n bigint
)
language sql
volatile
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

grant execute on function public.popular_picks() to anon, authenticated;