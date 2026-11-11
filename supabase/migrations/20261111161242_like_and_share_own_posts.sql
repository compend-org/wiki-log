-- People can like and reshare their own reviews and lists.
-- (The triggers already skip notifying you about your own likes and shares.)

drop policy if exists "users like as themselves" on public.likes;
create policy "users like as themselves"
  on public.likes for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "users like lists as themselves" on public.list_likes;
create policy "users like lists as themselves"
  on public.list_likes for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "users share as themselves" on public.shares;
create policy "users share as themselves"
  on public.shares for insert
  with check ((select auth.uid()) = user_id);