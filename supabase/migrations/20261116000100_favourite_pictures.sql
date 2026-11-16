-- A picture the person chose for an item in their top 5, from the item's
-- Wikipedia article. Null means the slot shows the item's own picture.
alter table public.favourites add column image_url text;

-- Only the server sets a slot's picture, after checking it is one of the
-- article's pictures, so people may write just these columns themselves.
revoke insert, update on public.favourites from anon, authenticated;
grant insert (user_id, position, item_id) on public.favourites to authenticated;
grant update (user_id, position, item_id) on public.favourites to authenticated;

-- A slot given another item drops the picture chosen for the one before
create function public.clear_favourite_picture()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.item_id is distinct from old.item_id then
    new.image_url := null;
  end if;
  return new;
end;
$$;

create trigger favourites_clear_picture
  before update on public.favourites
  for each row execute function public.clear_favourite_picture();

-- Finds the slots showing a picture Wikimedia no longer has. Few slots have
-- a picture of their own, so only those are indexed.
create index favourites_image_url_idx on public.favourites (image_url)
  where image_url is not null;
