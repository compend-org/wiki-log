-- ABOUTME: Returns in one call what the signed-in viewer has liked, shared and
-- ABOUTME: blocked among the reviews, lists and comments a page is showing.
create or replace function public.viewer_state(
  p_log_ids uuid[],
  p_list_ids uuid[],
  p_comment_ids uuid[] default '{}'
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
    'blocked', coalesce((
      select jsonb_agg(b.blocked_id)
      from public.blocks b
      where b.blocker_id = (select auth.uid())
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.viewer_state(uuid[], uuid[], uuid[])
  from public, anon;
grant execute on function public.viewer_state(uuid[], uuid[], uuid[])
  to authenticated, service_role;
