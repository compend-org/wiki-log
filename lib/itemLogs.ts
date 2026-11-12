// ABOUTME: Loads every log of one item for the logs section of an item page, newest first.
// ABOUTME: Also loads the ones one person liked; both come with each author and social counts.
import { createClient } from "@/lib/supabase/server";

export type ItemLogRow = {
  id: string;
  user_id: string;
  item_id: string;
  rating: number | null;
  review: string;
  logged_at: string;
  profiles: { username: string } | null;
  likes: { count: number }[];
  comments: { count: number }[];
  shares: { count: number }[];
};

const ITEM_LOG_SELECT =
  "id, user_id, item_id, rating, review, logged_at, profiles!logs_user_id_profiles_fkey(username), likes(count), comments(count), shares(count)";

export async function getItemLogs(itemId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("logs")
    .select(ITEM_LOG_SELECT)
    .eq("item_id", itemId)
    .order("logged_at", { ascending: false });
  return {
    rows: (data ?? []) as unknown as ItemLogRow[],
    error: error?.message ?? "",
  };
}

// The logs of one item that one person has liked, most recently liked first
export async function getItemLogsLikedBy(itemId: string, userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("logs")
    .select(`${ITEM_LOG_SELECT}, liked:likes!inner(user_id, created_at)`)
    .eq("item_id", itemId)
    .eq("liked.user_id", userId);
  const rows = (data ?? []) as unknown as (ItemLogRow & {
    liked: { created_at: string }[];
  })[];
  const likedAt = (r: (typeof rows)[number]) =>
    new Date(r.liked[0]?.created_at ?? 0).getTime();
  return {
    rows: rows.sort((a, b) => likedAt(b) - likedAt(a)) as ItemLogRow[],
    error: error?.message ?? "",
  };
}
