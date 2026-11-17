alter table public.lists
  add column last_bumped_at timestamptz,
  add column prev_bumped_at timestamptz,
  add column bumped_by_item text,
  add column activity_at timestamptz
    generated always as (greatest(created_at, last_bumped_at)) stored;

create index lists_activity_idx on public.lists (activity_at desc, id desc);
create index lists_user_activity_idx on public.lists (user_id, activity_at desc);

create function public.bump_list_on_item_added()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  update public.lists
  set prev_bumped_at = last_bumped_at,
      last_bumped_at = now(),
      bumped_by_item = new.item_id
  where id = new.list_id
    and now() > created_at + interval '10 minutes'
    and (last_bumped_at is null or now() > last_bumped_at + interval '12 hours');
  return null;
end;
$$;

create trigger list_items_bump
  after insert on public.list_items
  for each row execute function public.bump_list_on_item_added();

create function public.unbump_list_on_item_removed()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  next_item text;
begin
  if not exists (
    select 1 from public.lists
    where id = old.list_id and bumped_by_item = old.item_id
  ) then
    return null;
  end if;

  select li.item_id into next_item
  from public.list_items li
  join public.lists l on l.id = li.list_id
  where li.list_id = old.list_id and li.added_at >= l.last_bumped_at
  order by li.added_at, li.item_id
  limit 1;

  if next_item is not null then
    update public.lists set bumped_by_item = next_item where id = old.list_id;
  else
    update public.lists
    set last_bumped_at = prev_bumped_at,
        prev_bumped_at = null,
        bumped_by_item = null
    where id = old.list_id;
  end if;
  return null;
end;
$$;

create trigger list_items_unbump
  after delete on public.list_items
  for each row execute function public.unbump_list_on_item_removed();