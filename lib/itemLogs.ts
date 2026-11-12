// ABOUTME: Loads logs of one item a page at a time: the most liked, the newest, and the ones
// ABOUTME: one person liked. Each comes with its author and social counts.
import {
  inIdOrder,
  type Keyset,
  olderThan,
  PAGE_SIZE,
  pageOf,
} from "@/lib/paging";
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

// How many of the most-liked logs show at the top of an item's logs
const MOST_LIKED = 3;

// The most-liked logs of an item that have at least one like, most likes
// first, newer first when tied. Logs by people the viewer blocked are left out.
export async function getMostLikedLogs(itemId: string) {
  const supabase = await createClient();
  const { data: ids, error } = await supabase.rpc("most_liked_logs", {
    p_item_id: itemId,
    p_limit: MOST_LIKED,
  });
  const wanted = (ids ?? []) as string[];
  if (error || wanted.length === 0) {
    return { rows: [] as ItemLogRow[], error: error?.message ?? "" };
  }
  const { data, error: rowsError } = await supabase
    .from("logs")
    .select(ITEM_LOG_SELECT)
    .in("id", wanted);
  return {
    rows: inIdOrder((data ?? []) as unknown as ItemLogRow[], wanted),
    error: rowsError?.message ?? "",
  };
}

// One page of an item's logs, newest first, after `after`, leaving out the
// ones in `exclude`, and where the next page starts
export async function getItemLogs(
  itemId: string,
  exclude: string[],
  after: Keyset | null,
) {
  const supabase = await createClient();
  let query = supabase
    .from("logs")
    .select(ITEM_LOG_SELECT)
    .eq("item_id", itemId);
  if (exclude.length > 0) query = query.not("id", "in", `(${exclude})`);
  if (after) query = query.or(olderThan("logged_at", after));
  const { data, error } = await query
    .order("logged_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);
  const { page, next } = pageOf(
    (data ?? []) as unknown as ItemLogRow[],
    (r) => ({ at: r.logged_at, id: r.id }),
  );
  return { rows: page, next, error: error?.message ?? "" };
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

  const { page, next } = pageOf(
    (data ?? []) as unknown as {
      created_at: string;
      log_id: string;
      logs: ItemLogRow;
    }[],
    (r) => ({ at: r.created_at, id: r.log_id }),
  );
  return { rows: page.map((r) => r.logs), next, error: error?.message ?? "" };
}
