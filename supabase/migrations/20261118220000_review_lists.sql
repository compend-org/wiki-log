-- ABOUTME: Review lists: lists of people's reviews, which can hold several reviews of one item.
-- ABOUTME: Each review's author is told, once per list, when their review is added to one.

-- A review list's kind is chosen when it is made and never changes (people may
-- only update a list's title, description and ranking)
alter table public.lists
  add column of_reviews boolean not null default false,
  add constraint lists_reviews_not_grouped check (not (of_reviews and grouped));

-- A review list's entries are list items that also name a review; the item is
-- the one reviewed. An entry has its own id, as a review list may hold two
-- reviews of the same item. An item list still holds each item once.
alter table public.list_items
  add column id uuid not null default gen_random_uuid(),
  add column log_id uuid references public.logs(id) on delete cascade;

alter table public.list_items drop constraint list_items_pkey;
alter table public.list_items add primary key (id);

create unique index list_items_list_item_key
  on public.list_items (list_id, item_id) where log_id is null;
create unique index list_items_list_log_key
  on public.list_items (list_id, log_id) where log_id is not null;
-- Finds the lists a review is in, and its entries when the review is deleted
create index list_items_log_idx
  on public.list_items (log_id, added_at desc) where log_id is not null;

grant insert (log_id) on public.list_items to authenticated;

-- Keeps reviews in review lists and items in the others. A review's entry is
-- for the item reviewed, and only a review with some text, that isn't
-- removed, can be added; nor can one when its author and the list's owner
-- have blocked one another.
create function public.check_list_entry()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_reviews boolean;
  v_owner uuid;
  v_author uuid;
begin
  select of_reviews, user_id into v_reviews, v_owner
  from public.lists where id = new.list_id;

  if new.log_id is null then
    if v_reviews then
      raise exception 'Only reviews can be added to a review list.';
    end if;
    return new;
  end if;

  if not v_reviews then
    raise exception 'Reviews can only be added to a review list.';
  end if;

  select item_id, user_id into new.item_id, v_author
  from public.logs
  where id = new.log_id and removed_at is null and btrim(review) <> '';
  if not found then
    raise exception 'That review can''t be added to a list.';
  end if;

  if exists (
    select 1 from public.blocks b
    where (b.blocker_id = v_owner and b.blocked_id = v_author)
       or (b.blocker_id = v_author and b.blocked_id = v_owner)
  ) then
    raise exception 'You can''t do that here.';
  end if;

  return new;
end;
$$;

create trigger list_items_check_entry
  before insert on public.list_items
  for each row execute function public.check_list_entry();

-- Tells a review's author their review was added to someone else's list, once
-- per list
create function public.notify_on_list_review()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.notifications
    (recipient_id, actor_id, type, list_id, log_id)
  select g.user_id, l.user_id, 'list_review', l.id, g.id
  from public.logs g
  join public.lists l on l.id = new.list_id
  where g.id = new.log_id
    and g.user_id <> l.user_id
    and not exists (
      select 1 from public.notifications n
      where n.recipient_id = g.user_id
        and n.type = 'list_review'
        and n.list_id = l.id
        and n.log_id = g.id
    );
  return null;
end;
$$;

create trigger list_items_notify_review
  after insert on public.list_items
  for each row when (new.log_id is not null)
  execute function public.notify_on_list_review();

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'like', 'comment', 'reply', 'follow', 'list_like', 'list_comment',
    'list_reply', 'share', 'list_share', 'moderation', 'comment_like',
    'list_comment_like', 'mention', 'list_review'
  ));

-- Moves one entry of a list to a given place, shifting the ones in between,
-- like move_list_item but by entry, so it works when an item is in a list
-- twice. Runs as the caller, so the list_items policies decide who may do it.
create function public.move_list_entry(
  p_list uuid,
  p_entry uuid,
  p_position integer
)
returns void
language sql
set search_path = ''
as $$
  with others as (
    select id,
           row_number() over (order by position, id) as rn
    from public.list_items
    where list_id = p_list and id <> p_entry
  ),
  target as (
    select least(greatest(p_position, 1), (select count(*) from others) + 1) as pos
    where exists (
      select 1 from public.list_items
      where list_id = p_list and id = p_entry
    )
  ),
  wanted as (
    select others.id,
           case when others.rn >= target.pos then others.rn + 1 else others.rn end as pos
    from others, target
    union all
    select p_entry, target.pos from target
  )
  update public.list_items
  set position = wanted.pos::integer
  from wanted
  where list_items.list_id = p_list
    and list_items.id = wanted.id
    and list_items.position is distinct from wanted.pos::integer;
$$;

-- Removes one entry of a list and closes the gap, so positions stay 1, 2, 3...
create function public.remove_list_entry(p_list uuid, p_entry uuid)
returns void
language sql
set search_path = ''
as $$
  delete from public.list_items where list_id = p_list and id = p_entry;

  with ordered as (
    select id, row_number() over (order by position, id) as rn
    from public.list_items
    where list_id = p_list
  )
  update public.list_items
  set position = ordered.rn::integer
  from ordered
  where list_items.list_id = p_list
    and list_items.id = ordered.id
    and list_items.position is distinct from ordered.rn::integer;
$$;

revoke execute on function public.move_list_entry(uuid, uuid, integer)
  from public, anon;
grant execute on function public.move_list_entry(uuid, uuid, integer)
  to authenticated, service_role;
revoke execute on function public.remove_list_entry(uuid, uuid)
  from public, anon;
grant execute on function public.remove_list_entry(uuid, uuid)
  to authenticated, service_role;

-- The "Add to list" picker on an item page offers only item lists
create or replace function public.my_lists_for_item(
  p_item_id text,
  p_search text default '',
  p_offset integer default 0,
  p_limit integer default 50
)
returns table (
  id uuid,
  title text,
  ranked boolean,
  item_count bigint,
  has_item boolean,
  total bigint
)
language sql
stable
set search_path = ''
as $$
  with matching as (
    select l.id, l.title, l.ranked,
           greatest(
             l.created_at,
             (select max(li.added_at)
              from public.list_items li
              where li.list_id = l.id)
           ) as touched_at,
           count(*) over () as total
    from public.lists l
    where l.user_id = (select auth.uid())
      and not l.of_reviews
      and (coalesce(p_search, '') = ''
           or strpos(lower(l.title), lower(p_search)) > 0)
    order by touched_at desc, l.id desc
    offset greatest(p_offset, 0)
    limit least(greatest(p_limit, 1), 200)
  )
  select m.id,
         m.title,
         m.ranked,
         (select count(*) from public.list_items li where li.list_id = m.id),
         exists (
           select 1 from public.list_items li
           where li.list_id = m.id and li.item_id = p_item_id
         ),
         m.total
  from matching m
  order by m.touched_at desc, m.id desc;
$$;

-- The same for a review page's picker: the viewer's review lists, most
-- recently added to first, saying which already hold the review
create function public.my_lists_for_review(
  p_log_id uuid,
  p_search text default '',
  p_offset integer default 0,
  p_limit integer default 50
)
returns table (
  id uuid,
  title text,
  ranked boolean,
  item_count bigint,
  has_item boolean,
  total bigint
)
language sql
stable
set search_path = ''
as $$
  with matching as (
    select l.id, l.title, l.ranked,
           greatest(
             l.created_at,
             (select max(li.added_at)
              from public.list_items li
              where li.list_id = l.id)
           ) as touched_at,
           count(*) over () as total
    from public.lists l
    where l.user_id = (select auth.uid())
      and l.of_reviews
      and (coalesce(p_search, '') = ''
           or strpos(lower(l.title), lower(p_search)) > 0)
    order by touched_at desc, l.id desc
    offset greatest(p_offset, 0)
    limit least(greatest(p_limit, 1), 200)
  )
  select m.id,
         m.title,
         m.ranked,
         (select count(*) from public.list_items li where li.list_id = m.id),
         exists (
           select 1 from public.list_items li
           where li.list_id = m.id and li.log_id = p_log_id
         ),
         m.total
  from matching m
  order by m.touched_at desc, m.id desc;
$$;

revoke execute on function public.my_lists_for_review(uuid, text, integer, integer)
  from public, anon;
grant execute on function public.my_lists_for_review(uuid, text, integer, integer)
  to authenticated, service_role;

-- set_list_groups upserts by item, which the item-list key now covers
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
      on conflict (list_id, item_id) where log_id is null
      do update set position = excluded.position, group_id = excluded.group_id;
    end loop;
  end loop;

  delete from public.list_items where list_id = p_list and group_id is null;
end;
$$;
