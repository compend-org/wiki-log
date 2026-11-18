-- ABOUTME: Drops the lookup of a list owner's latest log of each item.
-- ABOUTME: The list page's hover card shows only the item's list note.

drop function public.latest_logs_of_items(uuid, text[]);
