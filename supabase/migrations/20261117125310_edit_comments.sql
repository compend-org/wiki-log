alter table public.comments add column edited_at timestamptz;
alter table public.list_comments add column edited_at timestamptz;

-- Only the text can be changed from the site; edited_at is set here, only
-- when the text really changed
create function public.mark_comment_edited()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.body is distinct from old.body then
    new.edited_at := now();
  else
    new.edited_at := old.edited_at;
  end if;
  return new;
end;
$$;

create trigger comments_mark_edited
  before update on public.comments
  for each row execute function public.mark_comment_edited();
create trigger list_comments_mark_edited
  before update on public.list_comments
  for each row execute function public.mark_comment_edited();

-- Authors edit their own comments, until the moderators remove them
create policy "authors edit their comments"
  on public.comments for update
  using ((select auth.uid()) = user_id and removed_at is null)
  with check ((select auth.uid()) = user_id);
create policy "authors edit their list comments"
  on public.list_comments for update
  using ((select auth.uid()) = user_id and removed_at is null)
  with check ((select auth.uid()) = user_id);

grant update (body) on public.comments to authenticated;
grant update (body) on public.list_comments to authenticated;

-- Suspended and banned people can't edit either
create trigger comments_restricted_edit
  before update of body on public.comments
  for each row execute function public.prevent_restricted_activity();
create trigger list_comments_restricted_edit
  before update of body on public.list_comments
  for each row execute function public.prevent_restricted_activity();

-- Mentions added by an edit are notified; people already told about this
-- comment aren't told again
create trigger comments_notify_mentions_edit
  after update of body on public.comments
  for each row when (old.body is distinct from new.body)
  execute function public.notify_on_comment_mention();
create trigger list_comments_notify_mentions_edit
  after update of body on public.list_comments
  for each row when (old.body is distinct from new.body)
  execute function public.notify_on_list_comment_mention();