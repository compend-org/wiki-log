-- The posts and shares the Following feed is made of: those by the people the
-- caller follows, and by the caller. The feed used to send everyone it
-- follows as `user_id=in.(...)` in the request URL, about 40 bytes per
-- person, which fails past a few hundred (the gateway's URL limit, then the
-- response header PostgREST echoes the query in). Here the follows are joined
-- in the database instead, so the request stays the same size however many
-- people are followed.
--
-- PostgREST selects, embeds, filters, orders and limits on top of these just
-- as on the tables. They are plain SQL functions with no SET clause so that
-- Postgres inlines them into that query and its order and limit can use the
-- tables' indexes; every name is schema-qualified instead. They run as the
-- caller, so the tables' row-level security still applies.

create function public.following_logs()
returns setof public.logs
language sql
stable
as $$
  select l.*
  from public.logs l
  where l.user_id = (select auth.uid())
     or l.user_id in (
       select f.following_id
       from public.follows f
       where f.follower_id = (select auth.uid())
     )
$$;

create function public.following_lists()
returns setof public.lists
language sql
stable
as $$
  select l.*
  from public.lists l
  where l.user_id = (select auth.uid())
     or l.user_id in (
       select f.following_id
       from public.follows f
       where f.follower_id = (select auth.uid())
     )
$$;

create function public.following_shares()
returns setof public.shares
language sql
stable
as $$
  select s.*
  from public.shares s
  where s.user_id = (select auth.uid())
     or s.user_id in (
       select f.following_id
       from public.follows f
       where f.follower_id = (select auth.uid())
     )
$$;

-- Signed-out callers follow nobody, so there is nothing for them here
revoke execute on function public.following_logs() from public, anon;
revoke execute on function public.following_lists() from public, anon;
revoke execute on function public.following_shares() from public, anon;
grant execute on function public.following_logs() to authenticated;
grant execute on function public.following_lists() to authenticated;
grant execute on function public.following_shares() to authenticated;
