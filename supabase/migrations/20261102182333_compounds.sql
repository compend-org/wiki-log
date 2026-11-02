create sequence public.compound_number;

create table public.compounds (
  item_id text primary key references public.items(id) on delete cascade,
  creator_id uuid references public.profiles(id) on delete set null,
  parts_key text not null unique,
  created_at timestamptz not null default now()
);

create table public.compound_parts (
  compound_id text not null references public.compounds(item_id) on delete cascade,
  part_id text not null references public.items(id),
  position smallint not null,
  primary key (compound_id, part_id)
);

create index compound_parts_part_idx on public.compound_parts (part_id);
create index compounds_creator_idx on public.compounds (creator_id, created_at desc);

alter table public.compounds enable row level security;
alter table public.compound_parts enable row level security;

create policy "compounds are public"
  on public.compounds for select using (true);
create policy "compound parts are public"
  on public.compound_parts for select using (true);

grant select on public.compounds to anon, authenticated;
grant select on public.compound_parts to anon, authenticated;
grant all on public.compounds to service_role;
grant all on public.compound_parts to service_role;

-- Creating a compound is one atomic step, and only your server may call it
create function public.create_compound(
  p_user uuid,
  p_title text,
  p_description text,
  p_parts text[]
)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_title text := btrim(p_title);
  v_desc text := nullif(btrim(coalesce(p_description, '')), '');
  v_n int := coalesce(array_length(p_parts, 1), 0);
  v_sorted text[];
  v_key text;
  v_existing record;
  v_id text;
begin
  if v_title is null or char_length(v_title) not between 1 and 80 then
    raise exception 'Names are 1-80 characters.';
  end if;
  if v_desc is not null and char_length(v_desc) > 500 then
    raise exception 'Descriptions are at most 500 characters.';
  end if;
  if v_n not between 2 and 8 then
    raise exception 'A compound needs 2 to 8 ingredients.';
  end if;

  select array_agg(x order by x) into v_sorted
  from (select distinct x from unnest(p_parts) as x) d;
  if array_length(v_sorted, 1) <> v_n then
    raise exception 'Each ingredient can only be used once.';
  end if;

  if (select count(*) from public.items where id = any(v_sorted)) <> v_n then
    raise exception 'One of those ingredients does not exist.';
  end if;

  -- The same set of ingredients, in any order, is the same compound
  v_key := array_to_string(v_sorted, '|');
  select c.item_id, i.title into v_existing
  from public.compounds c
  join public.items i on i.id = c.item_id
  where c.parts_key = v_key;
  if found then
    return jsonb_build_object(
      'id', v_existing.item_id, 'title', v_existing.title, 'existing', true
    );
  end if;

  if (
    select count(*) from public.compounds
    where creator_id = p_user and created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'You are crafting too fast. Please try again later.';
  end if;

  v_id := 'C' || nextval('public.compound_number');

  if v_desc is null then
    select 'Compound of ' || string_agg(i.title, ' + ' order by array_position(p_parts, i.id))
    into v_desc
    from public.items i
    where i.id = any(p_parts);
  end if;

  begin
    insert into public.items (id, title, description, image_url, page_url)
    values (v_id, v_title, v_desc, null, '');
    insert into public.compounds (item_id, creator_id, parts_key)
    values (v_id, p_user, v_key);
  exception when unique_violation then
    -- Someone made the same combination a moment ago
    select c.item_id, i.title into v_existing
    from public.compounds c
    join public.items i on i.id = c.item_id
    where c.parts_key = v_key;
    return jsonb_build_object(
      'id', v_existing.item_id, 'title', v_existing.title, 'existing', true
    );
  end;

  insert into public.compound_parts (compound_id, part_id, position)
  select v_id, t.p, t.ord::smallint
  from unnest(p_parts) with ordinality as t(p, ord);

  return jsonb_build_object('id', v_id, 'title', v_title, 'existing', false);
end;
$$;

revoke all on function public.create_compound(uuid, text, text, text[])
  from public, anon, authenticated;
grant execute on function public.create_compound(uuid, text, text, text[])
  to service_role;