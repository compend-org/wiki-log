-- ABOUTME: Lets people hide items they'd rather not see. Reviews of a hidden item
-- ABOUTME: are left out of what that person sees, and its pictures in lists are covered.
create table public.hidden_items (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null references public.items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create index hidden_items_item_idx on public.hidden_items (item_id);

-- Only you can see, add or remove what you have hidden
alter table public.hidden_items enable row level security;

create policy "users see own hidden items"
  on public.hidden_items for select
  using ((select auth.uid()) = user_id);
create policy "users hide items as themselves"
  on public.hidden_items for insert
  with check ((select auth.uid()) = user_id);
create policy "users unhide items as themselves"
  on public.hidden_items for delete
  using ((select auth.uid()) = user_id);

grant select, insert, delete on public.hidden_items to authenticated;
grant all on public.hidden_items to service_role;

-- viewer_state also reports every item the viewer has hidden
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
    'hidden_items', coalesce((
      select jsonb_agg(h.item_id)
      from public.hidden_items h
      where h.user_id = (select auth.uid())
    ), '[]'::jsonb),
    'sfw_mode', coalesce((
      select s.sfw_mode
      from public.user_settings s
      where s.user_id = (select auth.uid())
    ), 'off')
  );
$$;
