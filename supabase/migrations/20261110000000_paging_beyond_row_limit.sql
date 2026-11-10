-- ABOUTME: Queries that answer in a few rows what used to need thousands, past the API's 1,000-row cap.
-- ABOUTME: A list owner's latest log of each item with counts, and a page of the caller's lists for an item.

-- For each of these items, the person's latest log of it and how many times
-- they have logged it: one row per item they have logged, however many logs
-- that is. Runs as the caller, so the logs policies decide what is counted
-- (removed logs only for their author).
create function public.latest_logs_of_items(
  p_user uuid,
  p_item_ids text[]
)
returns table (
  item_id text,
  id uuid,
  rating numeric,
  review text,
  logged_at timestamptz,
  log_count bigint
)
language sql
stable
set search_path = ''
as $$
  select distinct on (l.item_id)
    l.item_id,
    l.id,
    l.rating,
    l.review,
    l.logged_at,
    count(*) over (partition by l.item_id) as log_count
  from public.logs l
  where l.user_id = p_user
    and l.item_id = any (p_item_ids)
  order by l.item_id, l.logged_at desc, l.id desc;
$$;

revoke execute on function public.latest_logs_of_items(uuid, text[])
  from public;
grant execute on function public.latest_logs_of_items(uuid, text[])
  to anon, authenticated, service_role;

-- One page of the caller's own lists, newest first, for adding an item to
-- one of them: how many items each holds, whether it already holds this item,
-- and how many of the caller's lists match the search in all. The search
-- matches anywhere in the title, ignoring case; an empty one matches every
-- list. Up to 10,000 lists can be gone through this way without sending
-- their ids anywhere.
create function public.my_lists_for_item(
  p_item_id text,
  p_search text default '',
  p_offset integer default 0,
  p_limit integer default 50
)
returns table (
  id uuid,
  title text,
  ranked boolean,
  item_count bigint,
  has_item boolean,
  total bigint
)
language sql
stable
set search_path = ''
as $$
  with matching as (
    select l.id, l.title, l.ranked, l.created_at,
           count(*) over () as total
    from public.lists l
    where l.user_id = (select auth.uid())
      and (coalesce(p_search, '') = ''
           or strpos(lower(l.title), lower(p_search)) > 0)
    order by l.created_at desc, l.id desc
    offset greatest(p_offset, 0)
    limit least(greatest(p_limit, 1), 200)
  )
  select m.id,
         m.title,
         m.ranked,
         (select count(*) from public.list_items li where li.list_id = m.id),
         exists (
           select 1 from public.list_items li
           where li.list_id = m.id and li.item_id = p_item_id
         ),
         m.total
  from matching m
  order by m.created_at desc, m.id desc;
$$;

revoke execute on function public.my_lists_for_item(text, text, integer, integer)
  from public, anon;
grant execute on function public.my_lists_for_item(text, text, integer, integer)
  to authenticated, service_role;
