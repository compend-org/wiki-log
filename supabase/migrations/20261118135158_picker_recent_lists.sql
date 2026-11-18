-- ABOUTME: The "Add to list" picker shows the lists most recently added to first.
-- ABOUTME: A list counts as touched when it was made or when an item was last added to it.

-- Finds each list's latest added item without reading all its items
create index list_items_list_added_idx
  on public.list_items (list_id, added_at desc);

-- Same as before, but ordered by when the list was last added to (or made, for
-- a list with no items) instead of when it was made
create or replace function public.my_lists_for_item(
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
    select l.id, l.title, l.ranked,
           greatest(
             l.created_at,
             (select max(li.added_at)
              from public.list_items li
              where li.list_id = l.id)
           ) as touched_at,
           count(*) over () as total
    from public.lists l
    where l.user_id = (select auth.uid())
      and (coalesce(p_search, '') = ''
           or strpos(lower(l.title), lower(p_search)) > 0)
    order by touched_at desc, l.id desc
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
  order by m.touched_at desc, m.id desc;
$$;