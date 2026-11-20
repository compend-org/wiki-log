-- ABOUTME: Log entries and lists their author hasn't published yet, kept to finish later.
-- ABOUTME: Only the author can read or change them. Each save sets saved_at, which later saves must match.

-- One unpublished entry per person per item
create table public.log_drafts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null references public.items(id) on delete cascade,
  rating numeric(2,1)
    check (rating between 0.5 and 5 and rating * 2 = floor(rating * 2)),
  review text not null default '' check (char_length(review) <= 5000),
  -- A picture picked from the item's article, and the page crediting it.
  -- Checked when the entry is logged.
  image_url text,
  image_file_page text,
  saved_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create index log_drafts_user_idx on public.log_drafts (user_id, saved_at desc);

-- A list being made. Its items are in `content`:
--   { "groups": [{ "name": "...", "items": ["Q1", ...] }, ...],
--     "notes": { "Q1": "..." }, "pictures": { "Q1": "https://..." } }
-- A plain list has one group, whose name is unused.
create table public.list_drafts (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  grouped boolean not null default false,
  title text not null default '' check (char_length(title) <= 80),
  description text not null default '' check (char_length(description) <= 500),
  ranked boolean not null default false,
  labeled boolean not null default true,
  content jsonb not null
    check (
      jsonb_typeof(content -> 'groups') = 'array'
      and octet_length(content::text) <= 1000000
    ),
  saved_at timestamptz not null default now()
);

create index list_drafts_user_idx on public.list_drafts (user_id, saved_at desc);

alter table public.log_drafts enable row level security;
alter table public.list_drafts enable row level security;

create policy "people manage their own log drafts"
  on public.log_drafts for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "people manage their own list drafts"
  on public.list_drafts for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- The item page's ratings call also returns the viewer's draft for the item
create or replace function public.item_ratings(p_item_id text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'ratings', coalesce((
      select jsonb_agg(
        jsonb_build_object('rating', latest.rating, 'people', latest.people)
        order by latest.rating
      )
      from (
        select per_person.rating, count(*) as people
        from (
          select distinct on (l.user_id) l.rating
          from public.logs l
          -- Removed logs stay readable by their author, so skipping them
          -- here makes the ratings the same for every viewer
          where l.item_id = p_item_id
            and l.rating is not null
            and l.removed_at is null
          order by l.user_id, l.logged_at desc
        ) per_person
        group by per_person.rating
      ) latest
    ), '[]'::jsonb),
    'log_count', (
      select count(*) from public.logs l where l.item_id = p_item_id
    ),
    'viewer_entries', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', l.id,
          'rating', l.rating,
          'review', l.review,
          'logged_at', l.logged_at
        )
        order by l.logged_at desc
      )
      from public.logs l
      where l.item_id = p_item_id and l.user_id = (select auth.uid())
    ), '[]'::jsonb),
    'viewer_draft', (
      select jsonb_build_object(
        'rating', d.rating,
        'review', d.review,
        'image_url', d.image_url,
        'image_file_page', d.image_file_page,
        'saved_at', d.saved_at
      )
      from public.log_drafts d
      where d.item_id = p_item_id and d.user_id = (select auth.uid())
    )
  );
$$;

-- The signed-in person's drafts for their drafts page, newest first. A list
-- draft comes with its number of items and its first few, not all of them.
create or replace function public.own_drafts()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'logs', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'item_id', d.item_id,
          'title', i.title,
          'image_url', coalesce(
            d.image_url,
            case when i.image_hidden then null else i.image_url end
          ),
          'nsfw', i.nsfw,
          'rating', d.rating,
          'review', d.review,
          'saved_at', d.saved_at
        )
        order by d.saved_at desc
      )
      from public.log_drafts d
      join public.items i on i.id = d.item_id
      where d.user_id = (select auth.uid())
    ), '[]'::jsonb),
    'lists', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'grouped', d.grouped,
          'ranked', d.ranked,
          'title', d.title,
          'saved_at', d.saved_at,
          'item_count', (
            select count(*)
            from jsonb_array_elements(d.content -> 'groups') g,
              jsonb_array_elements_text(g -> 'items') e
          ),
          'thumbs', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'title', i.title,
                'image_url', coalesce(
                  d.content -> 'pictures' ->> first.item_id,
                  case when i.image_hidden then null else i.image_url end
                ),
                'nsfw', i.nsfw
              )
              order by first.place
            )
            from (
              select e.item_id, row_number() over (order by g.n, e.n) as place
              from jsonb_array_elements(d.content -> 'groups')
                with ordinality g(grp, n),
                jsonb_array_elements_text(g.grp -> 'items')
                with ordinality e(item_id, n)
              order by g.n, e.n
              limit 12
            ) first
            join public.items i on i.id = first.item_id
          ), '[]'::jsonb)
        )
        order by d.saved_at desc
      )
      from public.list_drafts d
      where d.user_id = (select auth.uid())
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.own_drafts() from public, anon;
grant execute on function public.own_drafts() to authenticated, service_role;
