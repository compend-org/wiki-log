-- Finds the reviews showing a picture Wikimedia no longer has. Few reviews
-- have a picture of their own, so only those are indexed.
create index logs_image_url_idx on public.logs (image_url)
  where image_url is not null;
