-- ABOUTME: Indexes list_items by item, newest additions first.
-- ABOUTME: Serves the item page's lookup of the lists that include an item.
create index list_items_item_idx on public.list_items (item_id, added_at desc);
