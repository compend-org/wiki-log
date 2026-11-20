-- ABOUTME: Lets admins mark an item NSFW or safe by hand, and keeps that choice when the item is refreshed from Wikipedia.
-- ABOUTME: An admin-set flag is only changed by another admin's choice, never by the automatic adult-content check.

alter table public.items
  -- The admin who last set the adult flag by hand, if one did
  add column nsfw_set_by uuid references public.profiles (id) on delete set null,
  -- When an admin last set the adult flag by hand. Null means the flag comes
  -- from the automatic check.
  add column nsfw_set_at timestamptz;

-- Refreshes and backfills write `nsfw` from the automatic check. Once an admin
-- has set the flag, only an update that sets it again (with a new
-- nsfw_set_at) can change it.
create function public.keep_admin_nsfw()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.nsfw_set_at is not null
     and new.nsfw_set_at is not distinct from old.nsfw_set_at then
    new.nsfw := old.nsfw;
  end if;
  return new;
end;
$$;

create trigger keep_admin_nsfw
  before update on public.items
  for each row execute function public.keep_admin_nsfw();

-- Admins only: marks an item NSFW or safe, for good
create function public.admin_set_item_nsfw(p_item_id text, p_nsfw boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_site_admin();

  update public.items
  set nsfw = p_nsfw,
      nsfw_set_by = (select auth.uid()),
      nsfw_set_at = now()
  where id = p_item_id;
  if not found then
    raise exception 'That item doesn''t exist';
  end if;
end;
$$;

revoke execute on function public.keep_admin_nsfw() from public, anon, authenticated;
revoke execute on function public.admin_set_item_nsfw(text, boolean) from public, anon;
