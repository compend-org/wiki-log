-- People may only reorder their list items; an item's picture is set by the
-- server. A table-wide update grant from the database's defaults would let
-- them set it too, so it goes, and only position is granted back.
revoke update on public.list_items from anon, authenticated;
grant update (position) on public.list_items to authenticated;
