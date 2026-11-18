-- ABOUTME: Grouped lists: a list type whose items sit in ordered groups, labeled or not.
-- ABOUTME: Everything here is additive, so the feature can be repealed by dropping what it adds.

-- A grouped list is never ranked: its items are in groups, not in an order
alter table public.lists
  add column grouped boolean not null default false,
  add column group_labels boolean not null default true,
  add constraint lists_grouped_not_ranked check (not (grouped and ranked));

create table public.list_groups (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  -- 1, 2, 3... in the order the groups are shown
  position integer not null,
  -- Null in a list without labels
  name text check (name is null or char_length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  constraint list_groups_id_list_key unique (id, list_id)
);

create index list_groups_list_idx on public.list_groups (list_id, position);

-- An item's group. A group may only hold items of its own list, and deleting
-- a group lets go of its items (set null on the group only, not the list).
alter table public.list_items add column group_id uuid;
alter table public.list_items
  add constraint list_items_group_fkey
  foreign key (group_id, list_id)
  references public.list_groups (id, list_id)
  on delete set null (group_id);

create index list_items_group_idx on public.list_items (group_id)
  where group_id is not null;

alter table public.list_groups enable row level security;

create policy "list groups are public"
  on public.list_groups for select using (true);
create policy "owners add list groups"
  on public.list_groups for insert
  with check (exists (
    select 1 from public.lists l
    where l.id = list_groups.list_id and l.user_id = (select auth.uid())
  ));
create policy "owners edit list groups"
  on public.list_groups for update
  using (exists (
    select 1 from public.lists l
    where l.id = list_groups.list_id and l.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.lists l
    where l.id = list_groups.list_id and l.user_id = (select auth.uid())
  ));
create policy "owners remove list groups"
  on public.list_groups for delete
  using (exists (
    select 1 from public.lists l
    where l.id = list_groups.list_id and l.user_id = (select auth.uid())
  ));

revoke all on public.list_groups from anon, authenticated;
grant select on public.list_groups to anon, authenticated;
grant insert (list_id, position, name) on public.list_groups to authenticated;
grant update (position, name) on public.list_groups to authenticated;
grant delete on public.list_groups to authenticated;
grant all on public.list_groups to service_role;

-- People set an item's group the way they set its position
grant insert (group_id) on public.list_items to authenticated;
grant update (group_id) on public.list_items to authenticated;

-- At most 30 groups in a list
create function public.limit_list_groups()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if (select count(*) from public.list_groups where list_id = new.list_id) >= 30 then
    raise exception 'A list can have at most 30 groups.';
  end if;
  return new;
end;
$$;

create trigger list_groups_limit
  before insert on public.list_groups
  for each row execute function public.limit_list_groups();

-- Saves a grouped list's groups and items in one go: p_groups is an array of
-- { "name": text or null, "items": [item id, ...] } in the order to show them.
-- Items not mentioned are removed; ones kept keep their picture. Runs as the
-- caller, so the policies decide who may do it. At most 30 groups and 300
-- items, so a whole list fits one editor.
create function public.set_list_groups(p_list uuid, p_groups jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_labels boolean;
  v_group jsonb;
  v_item text;
  v_group_id uuid;
  v_name text;
  v_gpos integer := 0;
  v_ipos integer := 0;
  v_seen text[] := '{}';
begin
  select group_labels into v_labels
  from public.lists where id = p_list and grouped;
  if not found then
    raise exception 'That is not a grouped list.';
  end if;
  if jsonb_typeof(p_groups) <> 'array'
     or jsonb_array_length(p_groups) not between 1 and 30 then
    raise exception 'A grouped list has 1 to 30 groups.';
  end if;

  -- Let go of everything, then put it back in the new order
  update public.list_items set group_id = null where list_id = p_list;
  delete from public.list_groups where list_id = p_list;

  for v_group in select * from jsonb_array_elements(p_groups) loop
    if jsonb_typeof(v_group->'items') <> 'array' then
      raise exception 'Every group needs a list of items.';
    end if;
    v_name := nullif(btrim(coalesce(v_group->>'name', '')), '');
    if v_labels and v_name is null then
      raise exception 'Every group needs a name.';
    end if;
    if not v_labels then
      v_name := null;
    end if;

    v_gpos := v_gpos + 1;
    insert into public.list_groups (list_id, position, name)
    values (p_list, v_gpos, v_name)
    returning id into v_group_id;

    for v_item in
      select value from jsonb_array_elements_text(v_group->'items')
    loop
      if v_item = any (v_seen) then
        raise exception 'An item can only be in one group.';
      end if;
      v_seen := v_seen || v_item;
      if cardinality(v_seen) > 300 then
        raise exception 'A grouped list can hold at most 300 items.';
      end if;
      v_ipos := v_ipos + 1;
      insert into public.list_items (list_id, item_id, position, group_id)
      values (p_list, v_item, v_ipos, v_group_id)
      on conflict (list_id, item_id)
      do update set position = excluded.position, group_id = excluded.group_id;
    end loop;
  end loop;

  delete from public.list_items where list_id = p_list and group_id is null;
end;
$$;

revoke execute on function public.set_list_groups(uuid, jsonb) from public, anon;
grant execute on function public.set_list_groups(uuid, jsonb)
  to authenticated, service_role;
