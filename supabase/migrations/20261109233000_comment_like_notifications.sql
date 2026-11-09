-- ABOUTME: Tells people when someone likes their comment, on a review or a list,
-- ABOUTME: once per person per comment. The notice goes when the comment does.

alter table public.notifications
  add column comment_id uuid references public.comments(id) on delete cascade,
  add column list_comment_id uuid
    references public.list_comments(id) on delete cascade;

-- Deleting a comment looks up its notifications by these
create index notifications_comment_idx
  on public.notifications (comment_id) where comment_id is not null;
create index notifications_list_comment_idx
  on public.notifications (list_comment_id) where list_comment_id is not null;

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'like', 'comment', 'reply', 'follow', 'list_like', 'list_comment',
    'list_reply', 'share', 'list_share', 'moderation', 'comment_like',
    'list_comment_like'
  ));

-- Notify a review comment's author of a like (once per person per comment)
create function public.notify_on_comment_like()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.notifications
    (recipient_id, actor_id, type, log_id, comment_id)
  select c.user_id, new.user_id, 'comment_like', c.log_id, c.id
  from public.comments c
  where c.id = new.comment_id
    and c.user_id <> new.user_id
    and not exists (
      select 1 from public.notifications n
      where n.recipient_id = c.user_id
        and n.actor_id = new.user_id
        and n.type = 'comment_like'
        and n.comment_id = c.id
    );
  return new;
end;
$$;

create trigger comment_likes_notify
  after insert on public.comment_likes
  for each row execute function public.notify_on_comment_like();

-- Notify a list comment's author of a like (once per person per comment)
create function public.notify_on_list_comment_like()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.notifications
    (recipient_id, actor_id, type, list_id, list_comment_id)
  select c.user_id, new.user_id, 'list_comment_like', c.list_id, c.id
  from public.list_comments c
  where c.id = new.list_comment_id
    and c.user_id <> new.user_id
    and not exists (
      select 1 from public.notifications n
      where n.recipient_id = c.user_id
        and n.actor_id = new.user_id
        and n.type = 'list_comment_like'
        and n.list_comment_id = c.id
    );
  return new;
end;
$$;

create trigger list_comment_likes_notify
  after insert on public.list_comment_likes
  for each row execute function public.notify_on_list_comment_like();
