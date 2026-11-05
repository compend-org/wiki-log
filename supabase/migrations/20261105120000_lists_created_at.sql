-- ABOUTME: Indexes lists by creation time, newest first.
-- ABOUTME: Lets the Everyone feed read its newest lists without scanning them all.
create index lists_created_at_idx on public.lists (created_at desc);
