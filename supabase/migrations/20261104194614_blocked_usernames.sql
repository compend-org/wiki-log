-- Usernames that nobody can take: for deleted accounts
create table public.blocked_usernames (
  username text primary key,  -- always lowercase
  reason text,
  created_at timestamptz not null default now()
);

-- No policies: only you, in the dashboard, can read or change this table
alter table public.blocked_usernames enable row level security;

create function public.block_banned_usernames()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from public.blocked_usernames b
    where b.username = lower(new.username)
  ) then
    -- The same error as a name already taken. At sign-up the existing
    -- handle_new_user then gives the person a user_xxxx name instead.
    raise exception 'That username is not available'
      using errcode = 'unique_violation';
  end if;
  return new;
end;
$$;

create trigger block_banned_usernames
  before insert or update of username on public.profiles
  for each row execute function public.block_banned_usernames();