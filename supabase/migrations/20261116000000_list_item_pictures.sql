-- A picture the list's owner chose for an item in their list, from the item's
-- Wikipedia article. Null means the entry shows the item's own picture.
alter table public.list_items add column image_url text;

-- Only the server sets an entry's picture, after checking it is one of the
-- article's pictures, so people may insert just these columns themselves.
-- Updates are already limited to (position).
revoke insert on public.list_items from anon, authenticated;
grant insert (list_id, item_id, position) on public.list_items to authenticated;

-- Finds the entries showing a picture Wikimedia no longer has. Few entries
-- have a picture of their own, so only those are indexed.
create index list_items_image_url_idx on public.list_items (image_url)
  where image_url is not null;
