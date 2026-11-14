-- A public bucket for the pictures drawn for compounds: PNG only, 100 KB at
-- most. Only the server writes to it, with the service role, so there are no
-- insert policies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('compound-images', 'compound-images', true, 102400, array['image/png'])
on conflict (id) do nothing;

create policy "compound images are readable"
  on storage.objects for select
  using (bucket_id = 'compound-images');