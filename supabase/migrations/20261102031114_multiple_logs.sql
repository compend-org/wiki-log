-- 1. Every log gets its own id
alter table public.logs add column id uuid not null default gen_random_uuid();

-- 2. Point likes, comments and notifications at that id
alter table public.likes add column log_id uuid;
update public.likes l
  set log_id = g.id
  from public.logs g
  where g.user_id = l.log_user_id and g.item_id = l.log_item_id;
delete from public.likes where log_id is null;

alter table public.comments add column log_id uuid;
update public.comments c
  set log_id = g.id
  from public.logs g
  where g.user_id = c.log_user_id and g.item_id = c.log_item_id;
delete from public.comments where log_id is null;

alter table public.notifications add column log_id uuid;
update public.notifications n
  set log_id = g.id
  from public.logs g
  where g.user_id = n.log_user_id and g.item_id = n.log_item_id;

-- 3. Remove everything that depends on the old (user, item) key
drop policy "authors and review owners delete comments" on public.comments;
drop policy "users like as themselves" on public.likes;

alter table public.comments drop constraint comments_parent_fkey;
alter table public.comments drop constraint comments_log_fkey;
alter table public.comments drop constraint comments_id_log_key;
alter table public.comments drop column log_user_id, drop column log_item_id;

alter table public.likes drop column log_user_id, drop column log_item_id;
alter table public.notifications drop column log_user_id, drop column log_item_id;

-- 4. logs gets its new primary key
alter table public.logs drop constraint logs_pkey;
alter table public.logs add primary key (id);
create index logs_user_item_idx on public.logs (user_id, item_id, logged_at desc);
create index logs_item_idx on public.logs (item_id, logged_at desc);

-- 5. Re-attach likes, comments and notifications
alter table public.likes alter column log_id set not null;
alter table public.likes add primary key (user_id, log_id);
alter table public.likes add constraint likes_log_id_fkey
  foreign key (log_id) references public.logs(id) on delete cascade;
create index likes_log_idx on public.likes (log_id);

alter table public.comments alter column log_id set not null;
alter table public.comments add constraint comments_log_fkey
  foreign key (log_id) references public.logs(id) on delete cascade;
alter table public.comments add constraint comments_id_log_key unique (id, log_id);
alter table public.comments add constraint comments_parent_fkey
  foreign key (parent_id, log_id) references public.comments(id, log_id)
  on delete cascade;
create index comments_log_idx on public.comments (log_id, created_at);

alter table public.notifications add constraint notifications_log_fkey
  foreign key (log_id) references public.logs(id) on delete cascade;

-- 6. Rules: you can like anyone's entry except your own, and the owner of an
-- entry can delete comments on it
create policy "users like as themselves"
  on public.likes for insert
  with check (
    (select auth.uid()) = user_id
    and not exists (
      select 1 from public.logs g
      where g.id = likes.log_id and g.user_id = (select auth.uid())
    )
  );

create policy "authors and review owners delete comments"
  on public.comments for delete
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.logs g
      where g.id = comments.log_id and g.user_id = (select auth.uid())
    )
  );

-- Editing an entry may only change its rating and text
alter table public.logs
  add constraint logs_review_length check (char_length(review) <= 5000);
revoke update on public.logs from authenticated;
grant update (rating, review) on public.logs to authenticated;

-- 7. Notifications now find the owner through the entry
create or replace function public.notify_on_like()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  owner uuid;
begin
  select user_id into owner from public.logs where id = new.log_id;
  if owner is null or owner = new.user_id then
    return new;
  end if;

  insert into public.notifications (recipient_id, actor_id, type, log_id)
  select owner, new.user_id, 'like', new.log_id
  where not exists (
    select 1 from public.notifications n
    where n.recipient_id = owner
      and n.actor_id = new.user_id
      and n.type = 'like'
      and n.log_id = new.log_id
  );
  return new;
end;
$$;

create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  log_owner uuid;
  parent_author uuid;
begin
  select user_id into log_owner from public.logs where id = new.log_id;

  if new.parent_id is not null then
    select user_id into parent_author
    from public.comments where id = new.parent_id;

    if parent_author is not null and parent_author <> new.user_id then
      insert into public.notifications (recipient_id, actor_id, type, log_id)
      values (parent_author, new.user_id, 'reply', new.log_id);
    end if;
  end if;

  if log_owner is not null
     and log_owner <> new.user_id
     and log_owner is distinct from parent_author then
    insert into public.notifications (recipient_id, actor_id, type, log_id)
    values (log_owner, new.user_id, 'comment', new.log_id);
  end if;

  return new;
end;
$$;

-- At most 30 entries an hour per user
create function public.limit_log_rate()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if (
    select count(*) from public.logs
    where user_id = new.user_id
      and logged_at > now() - interval '1 hour'
  ) >= 30 then
    raise exception 'You are logging too fast. Please try again later.';
  end if;
  return new;
end;
$$;

create trigger logs_rate_limit
  before insert on public.logs
  for each row execute function public.limit_log_rate();