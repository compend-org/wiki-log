-- Reports: people flagging reviews, lists and comments for you to look at
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null
    check (target_type in ('log', 'list', 'comment', 'list_comment')),
  target_id uuid not null,
  -- Filled in by the trigger below, never trusted from the browser
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null
    check (reason in ('spam', 'harassment', 'hate', 'sexual', 'other')),
  details text check (details is null or char_length(details) <= 500),
  status text not null default 'open'
    check (status in ('open', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  -- One report per person per post
  unique (reporter_id, target_type, target_id)
);

create index reports_status_idx on public.reports (status, created_at desc);

create function public.fill_report()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  new.reported_user_id := case new.target_type
    when 'log' then (select user_id from public.logs where id = new.target_id)
    when 'list' then (select user_id from public.lists where id = new.target_id)
    when 'comment' then (select user_id from public.comments where id = new.target_id)
    when 'list_comment' then (select user_id from public.list_comments where id = new.target_id)
  end;

  if new.reported_user_id is null then
    raise exception 'That post no longer exists';
  end if;
  if new.reported_user_id = new.reporter_id then
    raise exception 'You cannot report your own post';
  end if;
  return new;
end;
$$;

create trigger reports_fill
  before insert on public.reports
  for each row execute function public.fill_report();

alter table public.reports enable row level security;

-- People can file reports as themselves. There is no select policy, so
-- nobody can read reports through the site: only you, in the dashboard.
create policy "users report as themselves" on public.reports
  for insert to authenticated
  with check (auth.uid() = reporter_id);