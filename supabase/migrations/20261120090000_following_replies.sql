-- The replies the Following feed shows: those written by the people the caller
-- follows, and by the caller, on reviews and on lists. Same shape as
-- following_logs() and friends (see 20261110180000): plain SQL with no SET
-- clause so Postgres inlines it, running as the caller so row-level security
-- still hides removed and blocked replies.

create function public.following_comments()
returns setof public.comments
language sql
stable
as $$
  select c.*
  from public.comments c
  where c.user_id = (select auth.uid())
     or c.user_id in (
       select f.following_id
       from public.follows f
       where f.follower_id = (select auth.uid())
     )
$$;

create function public.following_list_comments()
returns setof public.list_comments
language sql
stable
as $$
  select c.*
  from public.list_comments c
  where c.user_id = (select auth.uid())
     or c.user_id in (
       select f.following_id
       from public.follows f
       where f.follower_id = (select auth.uid())
     )
$$;

revoke execute on function public.following_comments() from public, anon;
revoke execute on function public.following_list_comments() from public, anon;
grant execute on function public.following_comments() to authenticated;
grant execute on function public.following_list_comments() to authenticated;
