-- ABOUTME: The Digest's query: the newest long reviews, a page at a time, and the index behind it.
-- ABOUTME: Matches what production already runs; this file was committed empty when it was applied.

-- A review counts as long above 720 characters. The function and the index
-- have to agree on that number, so that the index gets used.
create index logs_long_review_idx on public.logs (logged_at desc)
  where char_length(review) > 720;

create function public.long_logs(
  p_before timestamptz default null,
  p_limit integer default 21
)
returns setof public.logs
language sql
stable
set search_path = ''
as $$
  select l.*
  from public.logs l
  where char_length(l.review) > 720
    and l.logged_at < coalesce(p_before, 'infinity'::timestamptz)
  order by l.logged_at desc
  limit least(greatest(p_limit, 1), 100);
$$;
