-- ABOUTME: Records which comment each reply answers, as replies only nest one level deep.
-- ABOUTME: parent_id is always the thread's first comment, so a reply to a reply needs this to say whose it answers.

-- The comment Reply was pressed on: the thread's first comment, or one of the
-- replies under it. It is in the same review or list, and if it is deleted
-- the reply stays, answering no one in particular.
alter table public.comments
  add column reply_to_id uuid,
  add constraint comments_reply_to_fkey
    foreign key (reply_to_id, log_id)
    references public.comments(id, log_id)
    on delete set null (reply_to_id),
  add constraint comments_reply_to_needs_parent
    check (reply_to_id is null or parent_id is not null);

alter table public.list_comments
  add column reply_to_id uuid,
  add constraint list_comments_reply_to_fkey
    foreign key (reply_to_id, list_id)
    references public.list_comments(id, list_id)
    on delete set null (reply_to_id),
  add constraint list_comments_reply_to_needs_parent
    check (reply_to_id is null or parent_id is not null);

-- Deleting a comment clears it from the replies that answered it
create index comments_reply_to_idx
  on public.comments (reply_to_id) where reply_to_id is not null;
create index list_comments_reply_to_idx
  on public.list_comments (reply_to_id) where reply_to_id is not null;

-- A reply can only answer a comment in its own thread: the first comment or
-- another reply under it. Runs as the owner so a removed comment still counts.
create function public.check_comment_reply_to()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.reply_to_id is not null
     and new.reply_to_id is distinct from new.parent_id
     and not exists (
       select 1 from public.comments
       where id = new.reply_to_id and parent_id = new.parent_id
     ) then
    raise exception 'a reply can only answer a comment in its own thread'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create function public.check_list_comment_reply_to()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.reply_to_id is not null
     and new.reply_to_id is distinct from new.parent_id
     and not exists (
       select 1 from public.list_comments
       where id = new.reply_to_id and parent_id = new.parent_id
     ) then
    raise exception 'a reply can only answer a comment in its own thread'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_comment_reply_to() from public, anon, authenticated;
revoke execute on function public.check_list_comment_reply_to() from public, anon, authenticated;

create trigger comments_check_reply_to
  before insert on public.comments
  for each row execute function public.check_comment_reply_to();

create trigger list_comments_check_reply_to
  before insert on public.list_comments
  for each row execute function public.check_list_comment_reply_to();

-- Existing replies. Replying to a reply starts the text with a mention of its
-- author, so a reply that opens with a mention of someone who commented
-- earlier in the thread answers their latest comment before it. Any other
-- reply answers the thread's first comment.
update public.comments r
set reply_to_id = coalesce(
  (
    select c.id
    from public.comments c
    where c.log_id = r.log_id
      and (c.id = r.parent_id or c.parent_id = r.parent_id)
      and c.created_at < r.created_at
      and c.user_id::text = substring(
        r.body
        from '^\s*\[\[@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\|'
      )
    order by c.created_at desc
    limit 1
  ),
  r.parent_id
)
where r.parent_id is not null;

update public.list_comments r
set reply_to_id = coalesce(
  (
    select c.id
    from public.list_comments c
    where c.list_id = r.list_id
      and (c.id = r.parent_id or c.parent_id = r.parent_id)
      and c.created_at < r.created_at
      and c.user_id::text = substring(
        r.body
        from '^\s*\[\[@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\|'
      )
    order by c.created_at desc
    limit 1
  ),
  r.parent_id
)
where r.parent_id is not null;
