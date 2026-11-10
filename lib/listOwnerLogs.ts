// ABOUTME: Looks up a list owner's latest log of each item on a list, and how many times they logged it.
// ABOUTME: One row per item comes back however many logs there are, so the counts are exact.
import type { SupabaseClient } from "@supabase/supabase-js";
import { API_MAX_ROWS, chunks } from "@/lib/allRows";

export type OwnerLatestLog = {
  latest: {
    id: string;
    rating: number | null;
    review: string;
    logged_at: string;
  };
  // How many times the owner has logged the item
  count: number;
};

type Row = {
  item_id: string;
  id: string;
  rating: number | null;
  review: string;
  logged_at: string;
  log_count: number | string;
};

// Keyed by item id, for the items the owner has logged at all. The ids go in
// the request body, and each request asks about at most as many items as one
// response can carry.
export async function fetchOwnerLatestLogs(
  supabase: SupabaseClient,
  ownerId: string,
  itemIds: string[],
): Promise<Map<string, OwnerLatestLog>> {
  const responses = await Promise.all(
    chunks([...new Set(itemIds)], API_MAX_ROWS).map((ids) =>
      supabase.rpc("latest_logs_of_items", {
        p_user: ownerId,
        p_item_ids: ids,
      }),
    ),
  );
  const latest = new Map<string, OwnerLatestLog>();
  for (const { data } of responses) {
    for (const row of (data ?? []) as Row[]) {
      latest.set(row.item_id, {
        latest: {
          id: row.id,
          rating: row.rating,
          review: row.review,
          logged_at: row.logged_at,
        },
        count: Number(row.log_count),
      });
    }
  }
  return latest;
}
