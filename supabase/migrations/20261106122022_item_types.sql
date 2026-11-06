-- Wikidata IDs like Q11424. Null means not looked up yet; an empty array
-- means Wikidata lists no type for it.
alter table public.items add column if not exists types text[];
create index if not exists items_types_idx on public.items using gin (types);

-- The names of those types, so a page can say "film" instead of Q11424
create table if not exists public.item_types (
  id text primary key,
  label text not null,
  fetched_at timestamptz not null default now()
);
alter table public.item_types enable row level security;
create policy "anyone can read item types"
  on public.item_types for select using (true);

-- For the backfill script: writes the types of many items in one call.
-- p_rows looks like [{"id": "Q89", "types": ["Q3314483"]}, ...]
create or replace function public.set_item_types(p_rows jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.items i
  set types = coalesce(
    array(select jsonb_array_elements_text(r.value -> 'types')),
    '{}'
  )
  from jsonb_array_elements(p_rows) r
  where i.id = r.value ->> 'id';
$$;

-- Type IDs that items use but that have no name yet
create or replace function public.missing_type_ids()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select distinct t
  from public.items i, unnest(i.types) t
  where not exists (select 1 from public.item_types x where x.id = t);
$$;

revoke execute on function public.set_item_types(jsonb)
  from public, anon, authenticated;
revoke execute on function public.missing_type_ids()
  from public, anon, authenticated;
grant execute on function public.set_item_types(jsonb) to service_role;
grant execute on function public.missing_type_ids() to service_role;