-- ABOUTME: Suggested people now name items too, and rank noticed people above bulk loggers.
-- ABOUTME: Upgrades the pool and functions made by 20261118220000, and adds a list for signed-out visitors.

-- Up to 2 of the items they logged this week that got the most likes and
-- comments, as [{"id": ..., "title": ...}], adult ones left out
alter table public.suggestion_pool
  add column top_items jsonb not null default '[]';

-- Likes and new followers now count for more than logging, and logging counts
-- up to 10 logs, so a bulk logger doesn't win by volume. Also fills top_items.
create or replace function public.refresh_suggestion_pool()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.suggestion_pool where true;

  insert into public.suggestion_pool (user_id, activity, recent_logs, items, top_items)
  with logged as (
    select l.user_id, count(*) as n
    from public.logs l
    where l.removed_at is null
      and l.logged_at > now() - interval '7 days'
    group by l.user_id
  ),
  liked as (
    select l.user_id, count(*) as n
    from public.likes k
    join public.logs l on l.id = k.log_id
    where k.created_at > now() - interval '7 days'
      and l.removed_at is null
    group by l.user_id
  ),
  followed as (
    select f.following_id as user_id, count(*) as n
    from public.follows f
    where f.created_at > now() - interval '7 days'
    group by f.following_id
  ),
  scored as (
    select p.id as user_id,
           logged.n as recent_logs,
           ln(1 + least(logged.n, 10)
                + 3 * coalesce(liked.n, 0)
                + 5 * coalesce(followed.n, 0)) as activity
    from logged
    join public.profiles p on p.id = logged.user_id and p.banned_at is null
    left join liked on liked.user_id = p.id
    left join followed on followed.user_id = p.id
    where logged.n >= 2
    order by activity desc, p.id
    limit 300
  )
  select s.user_id, s.activity, s.recent_logs,
         coalesce(i.items, '{}'),
         coalesce(e.top_items, '[]'::jsonb)
  from scored s
  left join lateral (
    select array_agg(t.item_id order by t.latest desc) as items
    from (
      select l.item_id, max(l.logged_at) as latest
      from public.logs l
      join public.items it on it.id = l.item_id and not it.nsfw
      where l.user_id = s.user_id and l.removed_at is null
      group by l.item_id
      order by latest desc
      limit 60
    ) t
  ) i on true
  left join lateral (
    select jsonb_agg(
             jsonb_build_object('id', t.item_id, 'title', t.title)
             order by t.engaged desc, t.latest desc
           ) as top_items
    from (
      select l.item_id, it.title, max(l.logged_at) as latest,
             count(distinct k.user_id) + count(distinct c.id) as engaged
      from public.logs l
      join public.items it on it.id = l.item_id and not it.nsfw
      left join public.likes k
        on k.log_id = l.id and k.created_at > now() - interval '7 days'
      left join public.comments c
        on c.log_id = l.id
       and c.created_at > now() - interval '7 days'
       and c.removed_at is null
       and c.user_id <> l.user_id
      where l.user_id = s.user_id
        and l.removed_at is null
        and l.logged_at > now() - interval '7 days'
      group by l.item_id, it.title
      having count(distinct k.user_id) + count(distinct c.id) > 0
      order by engaged desc, latest desc
      limit 2
    ) t
  ) e on true;
end;
$$;

-- The result gains a column (featured), so the function is made again
drop function public.suggested_people(integer);

-- Up to p_limit people for the signed-in viewer to follow, best match first.
-- A match is made of: logging the same things, being followed by people you
-- follow, following you, and being noticed lately. A little per-person noise,
-- the same all day, makes each viewer's list their own and changes it daily.
-- It leaves out the viewer, people they follow, and anyone blocked either way.
-- `featured` is up to 2 items, as [{"id": ..., "title": ...}]: for 'overlap'
-- the ones you have both logged, for 'active' their most noticed this week.
create function public.suggested_people(p_limit integer default 8)
returns table (
  id uuid,
  username text,
  avatar_path text,
  recent_logs integer,
  followers bigint,
  -- 'follows_you', 'mutuals', 'overlap' or 'active': why they are suggested
  reason text,
  overlap integer,
  mutuals integer,
  mutual_name text,
  featured jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id),
  mine as (
    select coalesce(array_agg(t.item_id), '{}') as items
    from (
      select l.item_id
      from public.logs l
      join public.items it on it.id = l.item_id and not it.nsfw
      where l.user_id = (select id from me) and l.removed_at is null
      group by l.item_id
      order by max(l.logged_at) desc
      limit 100
    ) t
  ),
  cands as (
    select p.user_id, p.activity, p.recent_logs, p.items, p.top_items
    from public.suggestion_pool p
    join public.profiles pr on pr.id = p.user_id and pr.banned_at is null
    where (select id from me) is not null
      and p.user_id <> (select id from me)
      and not exists (
        select 1 from public.follows f
        where f.follower_id = (select id from me) and f.following_id = p.user_id
      )
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = (select id from me) and b.blocked_id = p.user_id)
           or (b.blocker_id = p.user_id and b.blocked_id = (select id from me))
      )
  ),
  mutual as (
    -- people the viewer follows who follow the candidate
    select f2.following_id as user_id, count(*)::integer as n,
           min(pr.username) as name
    from public.follows f1
    join public.follows f2 on f2.follower_id = f1.following_id
    join public.profiles pr on pr.id = f1.following_id
    where f1.follower_id = (select id from me)
      and f2.following_id in (select user_id from cands)
    group by f2.following_id
  ),
  scored as (
    select c.user_id, c.recent_logs, c.items, c.top_items,
           (select count(*)::integer from unnest(c.items) i
             where i = any(mine.items)) as overlap,
           coalesce(m.n, 0) as mutuals,
           m.name as mutual_name,
           exists (
             select 1 from public.follows f
             where f.follower_id = c.user_id and f.following_id = (select id from me)
           ) as follows_you,
           c.activity / nullif(max(c.activity) over (), 0) as activity,
           (hashtextextended(
              (select id from me)::text || c.user_id::text || current_date::text, 0
            ) & 1023) / 1024.0 as noise
    from cands c
    cross join mine
    left join mutual m on m.user_id = c.user_id
  ),
  reasoned as (
    select s.*,
           case
             when s.follows_you then 'follows_you'
             when s.mutuals > 0 then 'mutuals'
             when s.overlap > 0 then 'overlap'
             else 'active'
           end as reason
    from scored s
  )
  select p.id, p.username, p.avatar_path, r.recent_logs,
         (select count(*) from public.follows f where f.following_id = p.id) as followers,
         r.reason, r.overlap, r.mutuals, r.mutual_name,
         case r.reason
           when 'overlap' then sh.shared
           when 'active' then r.top_items
           else '[]'::jsonb
         end as featured
  from reasoned r
  cross join mine
  join public.profiles p on p.id = r.user_id
  left join lateral (
    -- up to 2 of the items you have both logged, newest first for them
    select coalesce(
             jsonb_agg(jsonb_build_object('id', it.id, 'title', it.title) order by x.ord),
             '[]'::jsonb
           ) as shared
    from (
      select u.i, u.ord
      from unnest(r.items) with ordinality as u(i, ord)
      where u.i = any(mine.items)
      order by u.ord
      limit 2
    ) x
    join public.items it on it.id = x.i
  ) sh on true
  order by 4 * least(r.overlap, 8) / 8.0
         + 3 * least(r.mutuals, 5) / 5.0
         + 3 * r.follows_you::integer
         + 3 * coalesce(r.activity, 0)
         + 2 * r.noise desc,
           p.id
  limit greatest(p_limit, 0);
$$;
revoke execute on function public.suggested_people(integer) from public, anon;
grant execute on function public.suggested_people(integer) to authenticated;

-- The most noticed people lately, for signed-out visitors. The same for
-- everyone who calls it; the page picks a few of them at random.
create function public.suggested_people_public(p_limit integer default 24)
returns table (
  id uuid,
  username text,
  avatar_path text,
  recent_logs integer,
  followers bigint,
  featured jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.avatar_path, sp.recent_logs,
         (select count(*) from public.follows f where f.following_id = p.id) as followers,
         sp.top_items as featured
  from public.suggestion_pool sp
  join public.profiles p on p.id = sp.user_id and p.banned_at is null
  order by sp.activity desc, p.id
  limit greatest(p_limit, 0);
$$;
revoke execute on function public.suggested_people_public(integer) from public;
grant execute on function public.suggested_people_public(integer) to anon, authenticated;

-- Fill the pool with the new columns now rather than in 10 minutes
select public.refresh_suggestion_pool();
