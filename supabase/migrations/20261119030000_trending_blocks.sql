-- ABOUTME: Lets an admin keep a post or list out of Trending, and take it back in.
-- ABOUTME: Trending skips anything in trending_blocks; only admins can change it, through admin_set_trending_block.

create table public.trending_blocks (
  log_id uuid unique references public.logs(id) on delete cascade,
  list_id uuid unique references public.lists(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint trending_blocks_one_post check (num_nonnulls(log_id, list_id) = 1)
);
alter table public.trending_blocks enable row level security;
-- The Trending functions read it as whoever is asking, so everyone can see it.
-- It holds only post ids.
create policy "anyone sees trending blocks" on public.trending_blocks
  for select using (true);
grant select on public.trending_blocks to anon, authenticated;
grant all on public.trending_blocks to service_role;

create or replace function public.trending_logs(
  p_hours int default 48,
  p_limit int default 31
)
returns table (row_id uuid, recent_likes bigint)
language sql
stable
set search_path = ''
as $$
  select l.log_id, count(*)
  from public.likes l
  join public.logs g on g.id = l.log_id
  where l.created_at > now() - make_interval(hours => p_hours)
    and (
      g.logged_at > now() - make_interval(hours => p_hours)
      or g.keep_trending
    )
    and not exists (
      select 1 from public.trending_blocks b where b.log_id = l.log_id
    )
  group by l.log_id
  order by count(*) desc, max(l.created_at) desc
  limit p_limit;
$$;

create or replace function public.trending_lists(
  p_hours int default 48,
  p_limit int default 31
)
returns table (row_id uuid, recent_likes bigint)
language sql
stable
set search_path = ''
as $$
  select l.list_id, count(*)
  from public.list_likes l
  join public.lists s on s.id = l.list_id
  where l.created_at > now() - make_interval(hours => p_hours)
    and s.created_at > now() - make_interval(hours => p_hours)
    and not exists (
      select 1 from public.trending_blocks b where b.list_id = l.list_id
    )
  group by l.list_id
  order by count(*) desc, max(l.created_at) desc
  limit p_limit;
$$;

-- Blocks or unblocks one post (p_kind 'log') or list (p_kind 'list'). Blocking
-- also takes away any pin it has.
create function public.admin_set_trending_block(
  p_kind text,
  p_id uuid,
  p_blocked boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_site_admin();
  if p_kind not in ('log', 'list') then
    raise exception 'Invalid post';
  end if;

  if not p_blocked then
    delete from public.trending_blocks
    where (p_kind = 'log' and log_id = p_id) or (p_kind = 'list' and list_id = p_id);
    return;
  end if;

  if p_kind = 'log' then
    insert into public.trending_blocks (log_id) values (p_id) on conflict do nothing;
    delete from public.trending_pins where log_id = p_id;
  else
    insert into public.trending_blocks (list_id) values (p_id) on conflict do nothing;
    delete from public.trending_pins where list_id = p_id;
  end if;
exception
  when foreign_key_violation then
    raise exception 'That post no longer exists';
end;
$$;
revoke execute on function public.admin_set_trending_block(text, uuid, boolean)
  from public, anon;
grant execute on function public.admin_set_trending_block(text, uuid, boolean)
  to authenticated;
