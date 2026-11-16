-- Signed-out visitors never change reviews, and a review's picture is set
-- only by the server. A table-wide update grant from the database's defaults
-- would let them try, so it goes.
revoke update on public.logs from anon;
