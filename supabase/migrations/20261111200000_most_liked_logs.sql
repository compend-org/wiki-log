-- ABOUTME: The most-liked logs of one item, for the top of the logs section of its page.
-- ABOUTME: Ranks in the database, so items with more logs than the API's row cap still rank right.

-- The ids of up to p_limit logs of this item that have at least one like,
-- most likes first, newer first when tied. Logs by people the caller has
-- blocked are left out. Runs as the caller, so the logs policies decide which
-- logs count.
create function public.most_liked_logs(p_item_id text, p_limit integer)
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select l.id
  from public.logs l
  join public.likes k on k.log_id = l.id
  where l.item_id = p_item_id
    and not exists (
      select 1 from public.blocks b
      where b.blocker_id = (select auth.uid())
        and b.blocked_id = l.user_id
    )
  group by l.id, l.logged_at
  order by count(*) desc, l.logged_at desc, l.id desc
  limit least(greatest(p_limit, 1), 50);
$$;

revoke execute on function public.most_liked_logs(text, integer) from public;
grant execute on function public.most_liked_logs(text, integer)
  to anon, authenticated, service_role;
