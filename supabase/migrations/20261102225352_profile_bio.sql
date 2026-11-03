alter table public.profiles
  add column bio text check (bio is null or char_length(bio) <= 300);

grant update (bio) on public.profiles to authenticated;