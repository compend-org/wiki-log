-- Refresh article images chosen by the old free-image-first selector on the
-- next item-page visit. Keep cached data for fallback if Wikipedia is down,
-- and leave compounds and image visibility preferences untouched.
update public.items
set fetched_at = '1970-01-01T00:00:00Z'
where id ~ '^Q[0-9]+$';
