alter table public.items
  add column image_non_free boolean not null default false,
  add column image_page_url text,
  add column image_hidden boolean not null default false;