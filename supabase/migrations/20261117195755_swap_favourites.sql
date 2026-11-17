-- ABOUTME: Lets people rearrange their top 5 by moving an item to another slot.
-- ABOUTME: move_favourite swaps the two slots, so the item already there takes the emptied one.

-- Moves the caller's item in slot p_from to slot p_to, keeping its picture.
-- Whatever was in p_to goes to p_from, so moving onto an empty slot leaves
-- p_from empty. Moving from an empty slot is a no-op. The rows are deleted
-- and inserted again because positions are the primary key, which an update
-- can't swap. It runs as its owner because people can't write a slot's
-- picture themselves (only the server checks and sets it).
create function public.move_favourite(p_from integer, p_to integer)
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
  where user_id = (select auth.uid()) and position = p_from
  returning * into moved;
  if not found then
    return;
  end if;

  delete from public.favourites
  where user_id = (select auth.uid()) and position = p_to
  returning * into displaced;
  swapping := found;

  insert into public.favourites (user_id, position, item_id, image_url)
  values (moved.user_id, p_to, moved.item_id, moved.image_url);
  if swapping then
    insert into public.favourites (user_id, position, item_id, image_url)
    values (displaced.user_id, p_from, displaced.item_id, displaced.image_url);
  end if;
end;
$$;

revoke execute on function public.move_favourite(integer, integer)
  from public, anon;
grant execute on function public.move_favourite(integer, integer)
  to authenticated, service_role;

notify pgrst, 'reload schema';
