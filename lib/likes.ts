import type { SupabaseClient } from "@supabase/supabase-js";

// Used by "liked these reviews": one person's likes on one item
export function likeKey(userId: string, itemId: string): string {
  return `${userId}:${itemId}`;
}

// Which of these entries has the viewer liked? Returns the entry ids.
export async function getLikedSet(
  supabase: SupabaseClient,
  viewerId: string | undefined,
  rows: { id: string }[],
): Promise<Set<string>> {
  if (!viewerId || rows.length === 0) return new Set();

  const { data } = await supabase
    .from("likes")
    .select("log_id")
    .eq("user_id", viewerId)
    .in(
      "log_id",
      rows.map((r) => r.id),
    );

  return new Set((data ?? []).map((r) => r.log_id as string));
}
