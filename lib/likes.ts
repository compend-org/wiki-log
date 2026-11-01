import type { SupabaseClient } from "@supabase/supabase-js";

export function likeKey(userId: string, itemId: string): string {
  return `${userId}:${itemId}`;
}

export async function getLikedSet(
  supabase: SupabaseClient,
  viewerId: string | undefined,
  rows: { user_id: string; item_id: string }[]
): Promise<Set<string>> {
  if (!viewerId || rows.length === 0) return new Set();

  const { data } = await supabase
    .from("likes")
    .select("log_user_id, log_item_id")
    .eq("user_id", viewerId)
    .in("log_item_id", rows.map((r) => r.item_id));

  return new Set(
    (data ?? []).map((r) => likeKey(r.log_user_id, r.log_item_id))
  );
}