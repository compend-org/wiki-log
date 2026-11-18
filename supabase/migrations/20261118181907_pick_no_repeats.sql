-- ABOUTME: An item the daily picks have shown isn't picked again for 24 hours.
-- ABOUTME: When no unshown item is left, a pick stays as it is until one turns up.

-- Every item that became a pick, and when
create table public.picks_history (
  item_id text not null,
  picked_at timestamptz not null default now()
);
create index picks_history_picked_at_idx on public.picks_history (picked_at);
-- Only the refresh job below reads or writes it
alter table public.picks_history enable row level security;

-- What the cache shows now has already been shown
insert into public.picks_history (item_id)
select c.item_id from public.picks_cache c;

-- As before, a random one of the 5 best and 5 worst-rated items of the last 24
-- hours, but leaving out items picked in the last 24 hours
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

-- Replaces each pick that has a new item, and leaves one alone that has none
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