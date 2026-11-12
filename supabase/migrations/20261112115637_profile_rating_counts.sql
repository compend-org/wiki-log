-- ABOUTME: How many items a person gave each half-star rating, for the histogram on their profile.
-- ABOUTME: Each item counts once, by the person's latest rating of it.

create or replace function public.profile_rating_counts(p_user uuid)
returns table (step numeric, n bigint)
language sql
stable
set search_path = ''
as $$
  with latest as (
    select distinct on (l.item_id) l.rating
    from public.logs l
    where l.user_id = p_user
      and l.rating is not null
    order by l.item_id, l.logged_at desc
  )
  select round(rating * 2) / 2 as step, count(*) as n
  from latest
  group by 1
  order by 1;
$$;

grant execute on function public.profile_rating_counts(uuid)
  to anon, authenticated;