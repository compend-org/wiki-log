-- ABOUTME: Moves one item of a list to a given place, shifting the items in between.
-- ABOUTME: Lets ranked lists of up to 10,000 items be placed without sending the whole order.

-- p_position is 1-based and clamped to the list; positions come out 1, 2, 3...
-- Only rows whose position changes are written. Runs as the caller, so the
-- list_items policies decide who may do it; an item not in the list is a no-op.
create function public.move_list_item(
  p_list uuid,
  p_item text,
  p_position integer
)
returns void
language sql
set search_path = ''
as $$
  with others as (
    select item_id,
           row_number() over (order by position, item_id) as rn
    from public.list_items
    where list_id = p_list and item_id <> p_item
  ),
  target as (
    select least(greatest(p_position, 1), (select count(*) from others) + 1) as pos
    where exists (
      select 1 from public.list_items
      where list_id = p_list and item_id = p_item
    )
  ),
  wanted as (
    select others.item_id,
           case when others.rn >= target.pos then others.rn + 1 else others.rn end as pos
    from others, target
    union all
    select p_item, target.pos from target
  )
  update public.list_items
  set position = wanted.pos::integer
  from wanted
  where list_items.list_id = p_list
    and list_items.item_id = wanted.item_id
    and list_items.position is distinct from wanted.pos::integer;
$$;

revoke execute on function public.move_list_item(uuid, text, integer)
  from public, anon;
grant execute on function public.move_list_item(uuid, text, integer)
  to authenticated, service_role;
