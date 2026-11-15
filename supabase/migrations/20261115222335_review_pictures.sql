-- A picture the author chose for their review from the item's Wikipedia
-- article. Null means the review shows the item's own picture.
alter table public.logs add column image_url text;

-- Only the server sets a review's picture, after checking it is one of the
-- article's pictures, so people may insert just these columns themselves.
-- Updates are already limited to (rating, review).
revoke insert on public.logs from anon, authenticated;
grant insert (user_id, item_id, rating, review) on public.logs to authenticated;
