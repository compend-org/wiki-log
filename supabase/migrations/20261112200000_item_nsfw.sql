-- True when an item is adult content, by what Wikidata says it is or by its
-- image. People who turn on SFW mode see these items' images blurred.
alter table public.items
  add column if not exists nsfw boolean not null default false;
