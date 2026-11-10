-- ABOUTME: Lets people report an account itself, for a username, avatar or bio, not only its posts.
-- ABOUTME: A profile report's target is the account's own id, and the admin pages show its current username and bio.

alter table public.reports drop constraint reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('log', 'list', 'comment', 'list_comment', 'profile'));

-- Closing or reopening a profile's reports is recorded like any other
alter table public.moderation_actions drop constraint moderation_actions_target_type_check;
alter table public.moderation_actions add constraint moderation_actions_target_type_check
  check (target_type in ('log', 'list', 'comment', 'list_comment', 'profile'));

create or replace function public.fill_report()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  new.reported_user_id := case new.target_type
    when 'log' then (select user_id from public.logs where id = new.target_id)
    when 'list' then (select user_id from public.lists where id = new.target_id)
    when 'comment' then (select user_id from public.comments where id = new.target_id)
    when 'list_comment' then (select user_id from public.list_comments where id = new.target_id)
    when 'profile' then (select id from public.profiles where id = new.target_id)
  end;

  if new.reported_user_id is null then
    raise exception 'That post no longer exists';
  end if;
  if new.reported_user_id = new.reporter_id then
    raise exception 'You cannot report your own post';
  end if;
  return new;
end;
$$;

-- Posts say whether and when they were removed. A profile is shown as its
-- username and bio, linking to the profile page.
create or replace function public.admin_post(p_kind text, p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'exists', true,
        'removed_at', l.removed_at,
        'at', l.logged_at,
        'body', l.review,
        'rating', l.rating,
        'item_id', l.item_id,
        'title', i.title,
        'href_log', jsonb_build_object('username', p.username, 'id', l.id)
      )
      from public.logs l
      join public.profiles p on p.id = l.user_id
      left join public.items i on i.id = l.item_id
      where p_kind = 'log' and l.id = p_id
    ),
    (
      select jsonb_build_object(
        'exists', true,
        'removed_at', li.removed_at,
        'at', li.created_at,
        'body', li.description,
        'title', li.title,
        'list_id', li.id,
        'item_count', (
          select count(*) from public.list_items x where x.list_id = li.id
        ),
        'item_titles', coalesce((
          select jsonb_agg(s.title order by s.position)
          from (
            select i.title, x.position
            from public.list_items x
            join public.items i on i.id = x.item_id
            where x.list_id = li.id
            order by x.position
            limit 40
          ) s
        ), '[]'::jsonb)
      )
      from public.lists li
      where p_kind = 'list' and li.id = p_id
    ),
    (
      select jsonb_build_object(
        'exists', true,
        'removed_at', c.removed_at,
        'at', c.created_at,
        'body', c.body,
        'item_id', l.item_id,
        'title', i.title,
        'href_log', jsonb_build_object('username', p.username, 'id', l.id)
      )
      from public.comments c
      join public.logs l on l.id = c.log_id
      join public.profiles p on p.id = l.user_id
      left join public.items i on i.id = l.item_id
      where p_kind = 'comment' and c.id = p_id
    ),
    (
      select jsonb_build_object(
        'exists', true,
        'removed_at', c.removed_at,
        'at', c.created_at,
        'body', c.body,
        'title', li.title,
        'list_id', li.id
      )
      from public.list_comments c
      join public.lists li on li.id = c.list_id
      where p_kind = 'list_comment' and c.id = p_id
    ),
    (
      select jsonb_build_object(
        'exists', true,
        'body', p.bio,
        'title', p.username,
        'href_profile', p.username
      )
      from public.profiles p
      where p_kind = 'profile' and p.id = p_id
    ),
    -- Reports outlive the post they're about
    jsonb_build_object('exists', false)
  );
$$;
