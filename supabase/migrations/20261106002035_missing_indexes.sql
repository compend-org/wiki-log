-- case-insensitive username lookups (profile pages, login, search)
create extension if not exists pg_trgm with schema extensions;
create index if not exists profiles_username_trgm_idx
  on public.profiles using gin (username extensions.gin_trgm_ops);

-- "who follows X" (follower counts, followers list)
create index if not exists follows_following_idx
  on public.follows (following_id);

-- a user's own logs, newest first (diary, profile)
create index if not exists logs_user_logged_idx
  on public.logs (user_id, logged_at desc);

-- notifications: list and unread count run on every page load
create index if not exists notifications_recipient_idx
  on public.notifications (recipient_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (recipient_id) where not read;
create index if not exists notifications_actor_idx
  on public.notifications (actor_id);

-- list comments are loaded per list
create index if not exists list_comments_list_idx
  on public.list_comments (list_id, created_at);
create index if not exists list_comments_user_idx
  on public.list_comments (user_id);