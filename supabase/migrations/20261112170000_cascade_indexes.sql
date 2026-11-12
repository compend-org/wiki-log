-- ABOUTME: Indexes the foreign keys that cascade deletes but had no index.
-- ABOUTME: Without them each deleted parent row scans the whole child table, so deleting an account with many logs timed out.

-- deleting a log or list removes its notifications
create index if not exists notifications_log_idx
  on public.notifications (log_id) where log_id is not null;
create index if not exists notifications_list_idx
  on public.notifications (list_id) where list_id is not null;

-- deleting a log or list removes its pins
create index if not exists pins_log_idx
  on public.pins (log_id) where log_id is not null;
create index if not exists pins_list_idx
  on public.pins (list_id) where list_id is not null;

-- deleting a comment removes its replies
create index if not exists comments_parent_idx
  on public.comments (parent_id) where parent_id is not null;
create index if not exists list_comments_parent_idx
  on public.list_comments (parent_id) where parent_id is not null;

-- deleting a profile removes reports about them
create index if not exists reports_reported_user_idx
  on public.reports (reported_user_id);
