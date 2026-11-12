-- Each person's own settings, one row each, which only they can read or change.
-- They live apart from profiles because profiles are public.
create table public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  -- How adult content is shown: as usual, with its images blurred, or with
  -- posts about it left out of feeds
  sfw_mode text not null default 'off' check (sfw_mode in ('off', 'blur', 'hide'))
);

alter table public.user_settings enable row level security;

create policy "users see own settings"
  on public.user_settings for select
  using ((select auth.uid()) = user_id);
create policy "users add own settings"
  on public.user_settings for insert
  with check ((select auth.uid()) = user_id);
create policy "users change own settings"
  on public.user_settings for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.user_settings to authenticated;
grant all on public.user_settings to service_role;

-- viewer_state also reports the viewer's SFW mode, so a page can leave out
-- what they asked not to see
create or replace function public.viewer_state(
  p_log_ids uuid[],
  p_list_ids uuid[],
  p_comment_ids uuid[] default '{}',
  p_list_comment_ids uuid[] default '{}'
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'liked_logs', coalesce((
      select jsonb_agg(l.log_id)
      from public.likes l
      where l.user_id = (select auth.uid()) and l.log_id = any(p_log_ids)
    ), '[]'::jsonb),
    'shared_logs', coalesce((
      select jsonb_agg(s.log_id)
      from public.shares s
      where s.user_id = (select auth.uid()) and s.log_id = any(p_log_ids)
    ), '[]'::jsonb),
    'liked_lists', coalesce((
      select jsonb_agg(l.list_id)
      from public.list_likes l
      where l.user_id = (select auth.uid()) and l.list_id = any(p_list_ids)
    ), '[]'::jsonb),
    'shared_lists', coalesce((
      select jsonb_agg(s.list_id)
      from public.shares s
      where s.user_id = (select auth.uid()) and s.list_id = any(p_list_ids)
    ), '[]'::jsonb),
    'liked_comments', coalesce((
      select jsonb_agg(c.comment_id)
      from public.comment_likes c
      where c.user_id = (select auth.uid()) and c.comment_id = any(p_comment_ids)
    ), '[]'::jsonb),
    'liked_list_comments', coalesce((
      select jsonb_agg(c.list_comment_id)
      from public.list_comment_likes c
      where c.user_id = (select auth.uid())
        and c.list_comment_id = any(p_list_comment_ids)
    ), '[]'::jsonb),
    'blocked', coalesce((
      select jsonb_agg(b.blocked_id)
      from public.blocks b
      where b.blocker_id = (select auth.uid())
    ), '[]'::jsonb),
    'sfw_mode', coalesce((
      select s.sfw_mode
      from public.user_settings s
      where s.user_id = (select auth.uid())
    ), 'off')
  );
$$;
