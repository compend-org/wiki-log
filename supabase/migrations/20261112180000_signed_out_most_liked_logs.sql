-- ABOUTME: Lets signed-out visitors run most_liked_logs, which reads blocks as the caller.
-- ABOUTME: Row Level Security still shows each person only their own blocks, so anon sees none.

-- most_liked_logs runs as the caller and leaves out logs by people the caller
-- blocked. Without this, every signed-out call fails with "permission denied
-- for table blocks".
grant select on public.blocks to anon;
