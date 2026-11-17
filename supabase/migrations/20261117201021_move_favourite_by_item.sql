-- ABOUTME: move_favourite names the item to move rather than the slot it was seen in.
-- ABOUTME: So a repeated move, or one made from an out-of-date page, can't undo another.

drop function public.move_favourite(integer, integer);

-- Moves the caller's item p_item to slot p_position, keeping its picture.
-- Whatever was in that slot goes to the slot the item left, so moving onto an
-- empty slot leaves the old one empty. Moving an item that isn't in the
-- caller's top 5, or to where it already is, is a no-op. The rows are deleted
-- and inserted again because positions are the primary key, which an update
-- can't swap. It runs as its owner because people can't write a slot's
-- picture themselves (only the server checks and sets it).
create function public.move_favourite(p_item text, p_position integer)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  moved public.favourites;
  displaced public.favourites;
  swapping boolean;
begin
  delete from public.favourites
  where user_id = (select auth.uid())
    and item_id = p_item
    and position <> p_position
  returning * into moved;
  if not found then
    return;
  end if;

  delete from public.favourites
  where user_id = (select auth.uid()) and position = p_position
  returning * into displaced;
  swapping := found;

  insert into public.favourites (user_id, position, item_id, image_url)
  values (moved.user_id, p_position, moved.item_id, moved.image_url);
  if swapping then
    insert into public.favourites (user_id, position, item_id, image_url)
    values (displaced.user_id, moved.position, displaced.item_id, displaced.image_url);
  end if;
end;
$$;

revoke execute on function public.move_favourite(text, integer)
  from public, anon;
grant execute on function public.move_favourite(text, integer)
  to authenticated, service_role;

notify pgrst, 'reload schema';
