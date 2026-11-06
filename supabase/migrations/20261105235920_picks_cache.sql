-- keep the heavy query, but make it private
alter function public.popular_picks() rename to compute_popular_picks;
revoke execute on function public.compute_popular_picks() from public, anon, authenticated;

create table public.picks_cache (
  kind text primary key,
  item_id text not null,
  avg_rating numeric not null,
  n bigint not null
);
alter table public.picks_cache enable row level security;

-- the same name the app already calls, now a cheap read
create function public.popular_picks()
returns table (kind text, item_id text, avg_rating numeric, n bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select c.kind, c.item_id, c.avg_rating, c.n from public.picks_cache c;
$$;
grant execute on function public.popular_picks() to anon, authenticated;

create function public.refresh_picks()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.picks_cache where true;
  insert into public.picks_cache (kind, item_id, avg_rating, n)
  select kind, item_id, avg_rating, n from public.compute_popular_picks();
end;
$$;
revoke execute on function public.refresh_picks() from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.schedule('refresh-picks', '* * * * *', $$select public.refresh_picks()$$);

select public.refresh_picks();