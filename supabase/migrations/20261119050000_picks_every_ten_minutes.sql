-- ABOUTME: The daily picks change every 10 minutes instead of every minute, and never show adult items.
-- ABOUTME: An item still isn't picked again within 24 hours of being picked.

-- As before, a random one of the 5 best and 5 worst-rated items of the last 24
-- hours, leaving out items picked in the last 24 hours, and now items marked
-- nsfw too
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
  per_item as (
    select r.item_id,
           round(avg(r.rating), 2) as avg_rating,
           count(*) as n
    from rated r
    join public.items it on it.id = r.item_id and not it.nsfw
    where not exists (
      select 1 from public.picks_history h
      where h.item_id = r.item_id
        and h.picked_at > now() - interval '24 hours'
    )
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
  -- random one of the 5 worst-rated items, always rated strictly lower than
  -- the popular pick (the new one, or the one still shown when there is no
  -- new one) so the two cards never show the same thing. Ratings are at most 5.
  worst as (
    select 'unpopular'::text as kind, t.item_id, t.avg_rating, t.n
    from (
      select * from per_item p
      where p.avg_rating < coalesce(
        (select b.avg_rating from best b),
        (select c.avg_rating from public.picks_cache c where c.kind = 'popular'),
        6
      )
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

-- Replaces each pick that has a new item, and leaves one alone that has none.
-- A pick that has turned out to be an adult item since it was chosen is taken
-- down first, so it doesn't stay up while there is nothing to replace it.
create or replace function public.refresh_picks()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  fresh record;
begin
  delete from public.picks_history where picked_at < now() - interval '48 hours';
  delete from public.picks_cache c
  where exists (
    select 1 from public.items it where it.id = c.item_id and it.nsfw
  );
  for fresh in select * from public.compute_popular_picks() loop
    insert into public.picks_cache (kind, item_id, avg_rating, n)
    values (fresh.kind, fresh.item_id, fresh.avg_rating, fresh.n)
    on conflict (kind) do update
      set item_id = excluded.item_id,
          avg_rating = excluded.avg_rating,
          n = excluded.n;
    insert into public.picks_history (item_id) values (fresh.item_id);
  end loop;
end;
$$;

-- Same job name, so this changes the existing schedule
select cron.schedule('refresh-picks', '*/10 * * * *', $$select public.refresh_picks()$$);
