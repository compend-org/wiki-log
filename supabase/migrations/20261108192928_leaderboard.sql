-- ABOUTME: Ranks the items of given Wikidata types by how people rated them.
-- ABOUTME: Used by the Leaderboards page, which caches the answer for a few minutes.

-- p_types: items with any of these Wikidata types are ranked together.
-- p_min: items with fewer ratings than this are left out, and it is also how
-- hard the ranking pulls an item with few ratings toward the average of all.
create or replace function public.leaderboard(
  p_types text[],
  p_min int default 3,
  p_limit int default 50
)
returns table (
  item_id text,
  avg_rating numeric,
  n bigint,
  score numeric
)
language sql
stable
set search_path = ''
as $$
  with rated as (
    -- each person's latest rating of each item
    select distinct on (l.user_id, l.item_id)
      l.item_id,
      l.rating
    from public.logs l
    join public.items i on i.id = l.item_id
    where l.rating is not null
      and i.types && p_types
    order by l.user_id, l.item_id, l.logged_at desc
  ),
  per_item as (
    select r.item_id, avg(r.rating) as a, count(*) as n
    from rated r
    group by r.item_id
  ),
  overall as (
    select coalesce(avg(r.rating), 3) as c from rated r
  )
  select
    p.item_id,
    round(p.a, 2) as avg_rating,
    p.n,
    -- a weighted average: few ratings count for less than many
    round(
      (p.n::numeric / (p.n + greatest(p_min, 1))) * p.a
      + (greatest(p_min, 1)::numeric / (p.n + greatest(p_min, 1))) * o.c,
      3
    ) as score
  from per_item p, overall o
  where p.n >= p_min
  order by score desc, p.n desc, p.item_id
  limit least(greatest(p_limit, 1), 200);
$$;

grant execute on function public.leaderboard(text[], int, int)
  to anon, authenticated;