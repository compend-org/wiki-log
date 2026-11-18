-- ABOUTME: For a list of people, how the signed-in viewer stands with each of them.
-- ABOUTME: Lets the followers and following pages show Follow, Follow back or Following buttons.

-- Takes the ids in the request body, so hundreds of people don't make a long URL.
-- Blocking either way counts, since neither of them can follow the other then.
create function public.follow_states(p_ids uuid[])
returns table (id uuid, following boolean, follows_you boolean, blocked boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id)
  select i,
         exists (
           select 1 from public.follows f
           where f.follower_id = (select id from me) and f.following_id = i
         ),
         exists (
           select 1 from public.follows f
           where f.follower_id = i and f.following_id = (select id from me)
         ),
         exists (
           select 1 from public.blocks b
           where (b.blocker_id = (select id from me) and b.blocked_id = i)
              or (b.blocker_id = i and b.blocked_id = (select id from me))
         )
  from unnest(p_ids) as i
  where (select id from me) is not null;
$$;
revoke execute on function public.follow_states(uuid[]) from public, anon;
grant execute on function public.follow_states(uuid[]) to authenticated;
