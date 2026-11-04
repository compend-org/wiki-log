-- Collapses the tricks that make one mailbox look like many:
-- "+tags" on any address, and dots in Gmail addresses
create function public.normalize_email(e text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(lower(btrim(e)), '@', 2) in ('gmail.com', 'googlemail.com')
      then replace(split_part(split_part(lower(btrim(e)), '@', 1), '+', 1), '.', '')
           || '@gmail.com'
    else split_part(split_part(lower(btrim(e)), '@', 1), '+', 1)
         || '@' || split_part(lower(btrim(e)), '@', 2)
  end;
$$;

create table public.blocked_emails (
  email text primary key,
  reason text,
  created_at timestamptz not null default now()
);

-- No policies: only you, in the dashboard, can read or change this table
alter table public.blocked_emails enable row level security;

create function public.block_banned_emails()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from public.blocked_emails b
    where b.email = public.normalize_email(new.email)
  ) then
    raise exception 'This email address cannot be used.';
  end if;
  return new;
end;
$$;

create trigger block_banned_emails_before_insert
  before insert on auth.users
  for each row execute function public.block_banned_emails();