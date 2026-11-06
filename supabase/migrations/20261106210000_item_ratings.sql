-- ABOUTME: Returns in one call how many people gave an item each rating, counting each
-- ABOUTME: person's latest rating once, its number of logs, and the viewer's own entries.
create or replace function public.item_ratings(p_item_id text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'ratings', coalesce((
      select jsonb_agg(
        jsonb_build_object('rating', latest.rating, 'people', latest.people)
        order by latest.rating
      )
      from (
        select per_person.rating, count(*) as people
        from (
          select distinct on (l.user_id) l.rating
          from public.logs l
          where l.item_id = p_item_id and l.rating is not null
          order by l.user_id, l.logged_at desc
        ) per_person
        group by per_person.rating
      ) latest
    ), '[]'::jsonb),
    'log_count', (
      select count(*) from public.logs l where l.item_id = p_item_id
    ),
    'viewer_entries', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', l.id,
          'rating', l.rating,
          'review', l.review,
          'logged_at', l.logged_at
        )
        order by l.logged_at desc
      )
      from public.logs l
      where l.item_id = p_item_id and l.user_id = (select auth.uid())
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.item_ratings(text) from public;
grant execute on function public.item_ratings(text)
  to anon, authenticated, service_role;
