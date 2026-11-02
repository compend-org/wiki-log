create table public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  ranked boolean not null default false,
  created_at timestamptz not null default now(),
  constraint lists_user_id_profiles_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade
);

create index lists_user_idx on public.lists (user_id, created_at desc);

create table public.list_items (
  list_id uuid not null references public.lists(id) on delete cascade,
  item_id text not null references public.items(id),
  position integer not null,
  added_at timestamptz not null default now(),
  primary key (list_id, item_id)
);

create index list_items_position_idx on public.list_items (list_id, position);

-- At most 50 lists per user and 100 items per list
create function public.limit_list_counts()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if tg_table_name = 'lists' then
    if (select count(*) from public.lists where user_id = new.user_id) >= 50 then
      raise exception 'You can have at most 50 lists.';
    end if;
  else
    if (select count(*) from public.list_items where list_id = new.list_id) >= 100 then
      raise exception 'A list can hold at most 100 items.';
    end if;
  end if;
  return new;
end;
$$;

create trigger lists_limit
  before insert on public.lists
  for each row execute function public.limit_list_counts();

create trigger list_items_limit
  before insert on public.list_items
  for each row execute function public.limit_list_counts();

-- Put a list in the given order (anything not mentioned goes last).
-- Runs as the caller, so the policies below decide who may do it.
create function public.reorder_list_items(p_list uuid, p_items text[])
returns void
language sql
set search_path = ''
as $$
  with ordered as (
    select li.item_id,
           row_number() over (
             order by coalesce(array_position(p_items, li.item_id), 2147483647),
                      li.position
           ) as rn
    from public.list_items li
    where li.list_id = p_list
  )
  update public.list_items
  set position = ordered.rn::integer
  from ordered
  where list_items.list_id = p_list
    and list_items.item_id = ordered.item_id;
$$;

-- Remove an item and close the gap, so positions stay 1, 2, 3...
create function public.remove_list_item(p_list uuid, p_item text)
returns void
language sql
set search_path = ''
as $$
  delete from public.list_items where list_id = p_list and item_id = p_item;

  with ordered as (
    select item_id, row_number() over (order by position) as rn
    from public.list_items
    where list_id = p_list
  )
  update public.list_items
  set position = ordered.rn::integer
  from ordered
  where list_items.list_id = p_list
    and list_items.item_id = ordered.item_id;
$$;

alter table public.lists enable row level security;
alter table public.list_items enable row level security;

create policy "lists are public"
  on public.lists for select using (true);
create policy "users create own lists"
  on public.lists for insert
  with check ((select auth.uid()) = user_id);
create policy "users update own lists"
  on public.lists for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "users delete own lists"
  on public.lists for delete
  using ((select auth.uid()) = user_id);

create policy "list items are public"
  on public.list_items for select using (true);
create policy "owners add list items"
  on public.list_items for insert
  with check (exists (
    select 1 from public.lists l
    where l.id = list_items.list_id and l.user_id = (select auth.uid())
  ));
create policy "owners reorder list items"
  on public.list_items for update
  using (exists (
    select 1 from public.lists l
    where l.id = list_items.list_id and l.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.lists l
    where l.id = list_items.list_id and l.user_id = (select auth.uid())
  ));
create policy "owners remove list items"
  on public.list_items for delete
  using (exists (
    select 1 from public.lists l
    where l.id = list_items.list_id and l.user_id = (select auth.uid())
  ));

grant select on public.lists to anon, authenticated;
grant insert, delete on public.lists to authenticated;
grant update (title, description, ranked) on public.lists to authenticated;
grant all on public.lists to service_role;

grant select on public.list_items to anon, authenticated;
grant insert, delete on public.list_items to authenticated;
grant update (position) on public.list_items to authenticated;
grant all on public.list_items to service_role;

grant execute on function public.reorder_list_items(uuid, text[]) to authenticated;
grant execute on function public.remove_list_item(uuid, text) to authenticated;