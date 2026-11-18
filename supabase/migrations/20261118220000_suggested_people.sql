-- ABOUTME: People to suggest following, picked for the viewer (the Following tab shows them).
-- ABOUTME: A shared pool of recently active people is refreshed every 10 minutes; each viewer's pick from it is their own.

-- Recently active people and what they have logged lately. Built by
-- refresh_suggestion_pool(), so that choosing for a viewer reads a few hundred
-- rows rather than all the logs.
create table public.suggestion_pool (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  -- How active they have been in the last 7 days, on a log scale
  activity numeric not null,
  recent_logs integer not null,
  -- The latest items they logged (up to 60), adult ones left out
  items text[] not null default '{}'
);
alter table public.suggestion_pool enable row level security;

create function public.refresh_suggestion_pool()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.suggestion_pool where true;

  insert into public.suggestion_pool (user_id, activity, recent_logs, items)
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
           ln(1 + logged.n + 2 * coalesce(liked.n, 0) + 3 * coalesce(followed.n, 0)) as activity
    from logged
    join public.profiles p on p.id = logged.user_id and p.banned_at is null
    left join liked on liked.user_id = p.id
    left join followed on followed.user_id = p.id
    where logged.n >= 2
    order by activity desc, p.id
    limit 300
  )
  select s.user_id, s.activity, s.recent_logs, coalesce(i.items, '{}')
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
  ) i on true;
end;
$$;
revoke execute on function public.refresh_suggestion_pool()
  from public, anon, authenticated;

-- Up to p_limit people for the signed-in viewer to follow, best match first.
-- A match is made of: logging the same things, being followed by people you
-- follow, following you, and being active lately. A little per-person noise,
-- the same all day, makes each viewer's list their own and changes it daily.
-- It leaves out the viewer, people they follow, and anyone blocked either way.
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
  mutual_name text
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
    select p.user_id, p.activity, p.recent_logs, p.items
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
    select c.user_id, c.recent_logs,
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
  )
  select p.id, p.username, p.avatar_path, s.recent_logs,
         (select count(*) from public.follows f where f.following_id = p.id) as followers,
         case
           when s.follows_you then 'follows_you'
           when s.mutuals > 0 then 'mutuals'
           when s.overlap > 0 then 'overlap'
           else 'active'
         end as reason,
         s.overlap, s.mutuals, s.mutual_name
  from scored s
  join public.profiles p on p.id = s.user_id
  order by 4 * least(s.overlap, 8) / 8.0
         + 3 * least(s.mutuals, 5) / 5.0
         + 3 * s.follows_you::integer
         + 3 * coalesce(s.activity, 0)
         + 2 * s.noise desc,
           p.id
  limit greatest(p_limit, 0);
$$;
revoke execute on function public.suggested_people(integer) from public, anon;
grant execute on function public.suggested_people(integer) to authenticated;

create extension if not exists pg_cron;
select cron.schedule('refresh-suggestion-pool', '*/10 * * * *', $$select public.refresh_suggestion_pool()$$);

select public.refresh_suggestion_pool();
