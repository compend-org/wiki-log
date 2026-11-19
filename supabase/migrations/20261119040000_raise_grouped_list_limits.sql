-- ABOUTME: Raises a grouped list's caps to 10,000 groups and 10,000 items, the same as a plain list.
-- ABOUTME: set_list_groups checks duplicates in one pass now, since doing it item by item gets slow at that size.

create or replace function public.limit_list_groups()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if (select count(*) from public.list_groups where list_id = new.list_id) >= 10000 then
    raise exception 'A list can have at most 10,000 groups.';
  end if;
  return new;
end;
$$;

-- Saves a grouped list's groups and items in one go: p_groups is an array of
-- { "name": text or null, "items": [item id, ...] } in the order to show them.
-- Items not mentioned are removed; ones kept keep their picture. Runs as the
-- caller, so the policies decide who may do it. At most 10,000 groups and
-- 10,000 items.
create or replace function public.set_list_groups(p_list uuid, p_groups jsonb)
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
  v_total integer;
  v_distinct integer;
begin
  select group_labels into v_labels
  from public.lists where id = p_list and grouped;
  if not found then
    raise exception 'That is not a grouped list.';
  end if;
  if jsonb_typeof(p_groups) <> 'array'
     or jsonb_array_length(p_groups) not between 1 and 10000 then
    raise exception 'A grouped list has 1 to 10000 groups.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_groups) g
    where jsonb_typeof(g.value->'items') is distinct from 'array'
  ) then
    raise exception 'Every group needs a list of items.';
  end if;

  -- Counting every item once, rather than checking each against those before it
  select count(*), count(distinct i.value)
  into v_total, v_distinct
  from jsonb_array_elements(p_groups) g,
       jsonb_array_elements_text(g.value->'items') i(value);
  if v_distinct < v_total then
    raise exception 'An item can only be in one group.';
  end if;
  if v_total > 10000 then
    raise exception 'A grouped list can hold at most 10000 items.';
  end if;

  -- Let go of everything, then put it back in the new order
  update public.list_items set group_id = null where list_id = p_list;
  delete from public.list_groups where list_id = p_list;

  for v_group in select * from jsonb_array_elements(p_groups) loop
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
