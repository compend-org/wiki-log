// ABOUTME: Loads every log of one item, newest first, with its author and social counts.
// ABOUTME: Shown in the logs section of an item page.
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

export async function getItemLogs(itemId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("logs")
    .select(
      "id, user_id, item_id, rating, review, logged_at, profiles!logs_user_id_profiles_fkey(username), likes(count), comments(count), shares(count)",
    )
    .eq("item_id", itemId)
    .order("logged_at", { ascending: false });
  return {
    rows: (data ?? []) as unknown as ItemLogRow[],
    error: error?.message ?? "",
  };
}
