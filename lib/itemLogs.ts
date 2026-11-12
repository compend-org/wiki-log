// ABOUTME: Loads every log of one item for the logs section of an item page, newest first.
// ABOUTME: Also loads the ones one person liked; both come with each author and social counts.
import { type Keyset, olderThan, PAGE_SIZE } from "@/lib/paging";
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

// One page of the logs of one item that one person has liked, most recently
// liked first, after `after`, and where the next page starts
export async function getItemLogsLikedBy(
  itemId: string,
  userId: string,
  after: Keyset | null,
) {
  const supabase = await createClient();
  let query = supabase
    .from("likes")
    .select(`created_at, log_id, logs!inner(${ITEM_LOG_SELECT})`)
    .eq("user_id", userId)
    .eq("logs.item_id", itemId);
  if (after) query = query.or(olderThan("created_at", after, "log_id"));
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("log_id", { ascending: false })
    .limit(PAGE_SIZE + 1);

  const rows = (data ?? []) as unknown as {
    created_at: string;
    log_id: string;
    logs: ItemLogRow;
  }[];
  const page = rows.slice(0, PAGE_SIZE);
  const last = page.at(-1);
  return {
    rows: page.map((r) => r.logs),
    next:
      rows.length > PAGE_SIZE && last
        ? { at: last.created_at, id: last.log_id }
        : null,
    error: error?.message ?? "",
  };
}
