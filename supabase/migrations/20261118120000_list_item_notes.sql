-- ABOUTME: A note on each list item, where the list's owner says why it's on the list.
-- ABOUTME: Also remembers whether the owner put away the hint that suggests writing notes.

-- Null means the item has no note. A note has some text and at most 500
-- characters.
alter table public.list_items add column note text
  check (note is null or (char_length(btrim(note)) >= 1 and char_length(note) <= 500));

-- Owners write notes themselves, when adding items and afterwards. An entry's
-- picture is still set only by the server.
grant insert (note) on public.list_items to authenticated;
grant update (note) on public.list_items to authenticated;

-- Whether the owner dismissed the hint on their own lists that suggests
-- writing notes
alter table public.user_settings
  add column list_notes_hint_dismissed boolean not null default false;
