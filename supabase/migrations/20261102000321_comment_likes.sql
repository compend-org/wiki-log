create table public.comment_likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  comment_id uuid not null references public.comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, comment_id)
);

create index comment_likes_comment_idx on public.comment_likes (comment_id);

alter table public.comment_likes enable row level security;

create policy "comment likes are public"
  on public.comment_likes for select using (true);

-- You can like anyone's comment except your own
create policy "users like comments as themselves"
  on public.comment_likes for insert
  with check (
    (select auth.uid()) = user_id
    and not exists (
      select 1 from public.comments c
      where c.id = comment_likes.comment_id
        and c.user_id = (select auth.uid())
    )
  );

create policy "users unlike comments as themselves"
  on public.comment_likes for delete
  using ((select auth.uid()) = user_id);

grant select on public.comment_likes to anon, authenticated;
grant insert, delete on public.comment_likes to authenticated;
grant all on public.comment_likes to service_role;