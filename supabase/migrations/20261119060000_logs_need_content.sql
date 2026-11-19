-- ABOUTME: A log needs a rating or some review text, or it says nothing.
-- ABOUTME: Checked by a trigger on new and changed ratings and reviews, so entries that are already empty are left alone.

create or replace function public.require_log_content()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.rating is null and btrim(coalesce(new.review, '')) = '' then
    -- Raised for people (P0001), so the app shows it as written
    raise exception 'Add a rating or a review.';
  end if;
  return new;
end;
$$;

-- Only when the rating or review is written, so moderation, pictures and
-- other changes to an older empty entry still go through
create trigger logs_require_content
  before insert or update of rating, review on public.logs
  for each row execute function public.require_log_content();
