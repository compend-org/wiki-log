-- ABOUTME: The daily picks rank items by a weighted rating, so one extreme rating no longer decides them.
-- ABOUTME: Only the ranking changes; the cards still show each item's plain average and number of ratings.

-- Ranking by the plain average put an item with a single half-star rating at
-- the bottom, and one with a single 5 at the top, above items that many people
-- had rated. Items are now ranked by their average pulled towards the average
-- of everything rated in the last 24 hours, as if each had PRIOR_WEIGHT
-- ratings at that average already:
--
--   score = (n * avg + PRIOR_WEIGHT * overall) / (n + PRIOR_WEIGHT)
--
-- With few ratings an item sits near the middle, and the more people rate it
-- the closer its score gets to its real average. So 1 rating of 0.5 ranks
-- above (less unpopular than) 8 ratings averaging 1.5, and 1 rating of 5 ranks
-- below 8 ratings averaging 4.5.
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
  overall as (
    select avg(r.rating) as mean from rated r
  ),
  per_item as (
    select r.item_id,
           round(avg(r.rating), 2) as avg_rating,
           count(*) as n,
           -- how many ratings' worth of the overall average each item starts with
           (count(*) * avg(r.rating) + 3 * (select o.mean from overall o))
             / (count(*) + 3) as score
    from rated r
    join public.items it on it.id = r.item_id and not it.nsfw
    where not exists (
      select 1 from public.picks_history h
      where h.item_id = r.item_id
        and h.picked_at > now() - interval '24 hours'
    )
    group by r.item_id
  ),
  -- random one of the 5 best-scoring items
  best as (
    select 'popular'::text as kind, t.item_id, t.avg_rating, t.n
    from (
      select * from per_item p
      order by p.score desc, p.n desc, p.item_id
      limit 5
    ) t
    order by random()
    limit 1
  ),
  -- random one of the 5 lowest-scoring items, always with a strictly lower
  -- average than the popular pick (the new one, or the one still shown when
  -- there is no new one) so the two cards never show the same thing. Ratings
  -- are at most 5.
  worst as (
    select 'unpopular'::text as kind, t.item_id, t.avg_rating, t.n
    from (
      select * from per_item p
      where p.avg_rating < coalesce(
        (select b.avg_rating from best b),
        (select c.avg_rating from public.picks_cache c where c.kind = 'popular'),
        6
      )
      order by p.score asc, p.n desc, p.item_id
      limit 5
    ) t
    order by random()
    limit 1
  )
  select * from best
  union all
  select * from worst;
$$;
