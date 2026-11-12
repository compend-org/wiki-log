// ABOUTME: Loads every log of one item for the logs section of an item page, newest first.
// ABOUTME: Also loads chosen logs; both come with each author and social counts.
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

// The logs with these ids, in the order the ids are given
export async function getLogsByIds(ids: string[]) {
  if (ids.length === 0) return { rows: [] as ItemLogRow[], error: "" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("logs")
    .select(ITEM_LOG_SELECT)
    .in("id", ids);
  const byId = new Map(
    ((data ?? []) as unknown as ItemLogRow[]).map((r) => [r.id, r]),
  );
  return {
    rows: ids.flatMap((id) => {
      const row = byId.get(id);
      return row ? [row] : [];
    }),
    error: error?.message ?? "",
  };
}
