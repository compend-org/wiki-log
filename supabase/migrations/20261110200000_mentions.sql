-- ABOUTME: Tells people when they're @-mentioned in a review or a comment, and finds
-- ABOUTME: who can be mentioned: anyone but yourself, banned people and people blocked either way.

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'like', 'comment', 'reply', 'follow', 'list_like', 'list_comment',
    'list_reply', 'share', 'list_share', 'moderation', 'comment_like',
    'list_comment_like', 'mention'
  ));

-- People whose username contains `term`, for the viewer to mention: never the
-- viewer, banned people, nor anyone they've blocked or who has blocked them
create function public.mentionable_people(term text)
returns table (id uuid, username text, avatar_path text)
language sql
stable
security definer set search_path = ''
as $$
  select p.id, p.username, p.avatar_path
  from public.profiles p
  where p.username ilike '%' || term || '%'
    and p.id <> auth.uid()
    and p.banned_at is null
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
         or (b.blocked_id = auth.uid() and b.blocker_id = p.id)
    )
  order by p.username
  limit 8;
$$;

revoke execute on function public.mentionable_people(text) from public, anon;
grant execute on function public.mentionable_people(text)
  to authenticated, service_role;

-- Notifies the first 10 people mentioned in `body` ([[@<id>|name]]), except
-- the author, anyone in `already_notified`, banned people, people blocked
-- either way, and anyone already told about this same mention. Nobody is told
-- about a mention on a review or list the moderators removed, which only its
-- author can still see.
create function public.notify_mentions(
  author uuid,
  body text,
  already_notified uuid[],
  on_log uuid,
  on_list uuid,
  on_comment uuid,
  on_list_comment uuid
)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from public.logs where id = on_log and removed_at is not null
  ) or exists (
    select 1 from public.lists where id = on_list and removed_at is not null
  ) then
    return;
  end if;

  insert into public.notifications
    (recipient_id, actor_id, type, log_id, list_id, comment_id, list_comment_id)
  select p.id, author, 'mention', on_log, on_list, on_comment, on_list_comment
  from (
    select distinct on (m.id) m.id, m.n
    from (
      select match[1]::uuid as id, ordinality as n
      from regexp_matches(
        body, '\[\[@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\|',
        'g'
      ) with ordinality as match
    ) m
    order by m.id, m.n
  ) mentioned
  join public.profiles p on p.id = mentioned.id
  where p.id <> author
    and p.banned_at is null
    and not (p.id = any(array_remove(coalesce(already_notified, '{}'), null)))
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = author and b.blocked_id = p.id)
         or (b.blocked_id = author and b.blocker_id = p.id)
    )
    and not exists (
      select 1 from public.notifications n
      where n.recipient_id = p.id
        and n.actor_id = author
        and n.type = 'mention'
        and n.log_id is not distinct from on_log
        and n.list_id is not distinct from on_list
        and n.comment_id is not distinct from on_comment
        and n.list_comment_id is not distinct from on_list_comment
    )
  order by mentioned.n
  limit 10;
end;
$$;

revoke execute on function public.notify_mentions(
  uuid, text, uuid[], uuid, uuid, uuid, uuid
) from public, anon, authenticated;

-- Mentions in a review, when it's written and whenever it's edited
create function public.notify_on_review_mention()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  perform public.notify_mentions(
    new.user_id, new.review, '{}', new.id, null, null, null
  );
  return new;
end;
$$;

create trigger logs_notify_mentions
  after insert or update of review on public.logs
  for each row execute function public.notify_on_review_mention();

-- Mentions in a comment on a review. The review's owner and the author of the
-- comment replied to already hear about it as a comment or a reply.
create function public.notify_on_comment_mention()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  perform public.notify_mentions(
    new.user_id,
    new.body,
    array[
      (select user_id from public.logs where id = new.log_id),
      (select user_id from public.comments where id = new.parent_id)
    ],
    new.log_id, null, new.id, null
  );
  return new;
end;
$$;

create trigger comments_notify_mentions
  after insert on public.comments
  for each row execute function public.notify_on_comment_mention();

-- Mentions in a comment on a list. The list's owner and the author of the
-- comment replied to already hear about it as a comment or a reply.
create function public.notify_on_list_comment_mention()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  perform public.notify_mentions(
    new.user_id,
    new.body,
    array[
      (select user_id from public.lists where id = new.list_id),
      (select user_id from public.list_comments where id = new.parent_id)
    ],
    null, new.list_id, null, new.id
  );
  return new;
end;
$$;

create trigger list_comments_notify_mentions
  after insert on public.list_comments
  for each row execute function public.notify_on_list_comment_mention();
