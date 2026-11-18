-- ABOUTME: Remembers when someone dismissed the "people to follow" box on their Following tab.
-- ABOUTME: The box stays away for a while after that; it is one more of each person's own settings.

alter table public.user_settings
  add column suggested_people_dismissed_at timestamptz;
