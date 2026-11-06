-- ABOUTME: Finds a profile by username, ignoring case, using the unique index
-- ABOUTME: on lower(username) instead of scanning every profile.
create or replace function public.profile_by_username(name text)
returns setof public.profiles
language sql
stable
set search_path = ''
as $$
  select p.*
  from public.profiles p
  where lower(p.username) = lower(name);
$$;

grant execute on function public.profile_by_username(text)
  to anon, authenticated, service_role;
