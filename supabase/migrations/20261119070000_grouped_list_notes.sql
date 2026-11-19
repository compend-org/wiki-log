-- ABOUTME: Lets set_list_groups save the notes on a grouped list's items along with its groups.
-- ABOUTME: Notes already live on list_items; this only lets the grouped editor send them.

-- p_notes is an object of item id -> note text. When it is given, every item
-- kept in the list gets the note listed for it, and none if it isn't listed,
-- so removing a note works. Without it (null) the items keep their notes.
-- Otherwise this is the function from the 10,000-item migration.
drop function public.set_list_groups(uuid, jsonb);

create function public.set_list_groups(
  p_list uuid,
  p_groups jsonb,
  p_notes jsonb default null
)
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
  v_note text;
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
  if p_notes is not null and jsonb_typeof(p_notes) <> 'object' then
    raise exception 'Notes are an object of item ids and texts.';
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
      v_note := case
        when p_notes is null then null
        else nullif(btrim(coalesce(p_notes->>v_item, '')), '')
      end;
      insert into public.list_items (list_id, item_id, position, group_id, note)
      values (p_list, v_item, v_ipos, v_group_id, v_note)
      on conflict (list_id, item_id)
      do update set
        position = excluded.position,
        group_id = excluded.group_id,
        note = case
          when p_notes is null then public.list_items.note
          else excluded.note
        end;
    end loop;
  end loop;

  delete from public.list_items where list_id = p_list and group_id is null;
end;
$$;

revoke execute on function public.set_list_groups(uuid, jsonb, jsonb)
  from public, anon;
grant execute on function public.set_list_groups(uuid, jsonb, jsonb)
  to authenticated, service_role;
