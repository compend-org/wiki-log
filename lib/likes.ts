import type { SupabaseClient } from "@supabase/supabase-js";

export function likeKey(userId: string, videoId: string): string {
  return `${userId}:${videoId}`;
}

export async function getLikedSet(
  supabase: SupabaseClient,
  viewerId: string | undefined,
  rows: { user_id: string; video_id: string }[]
): Promise<Set<string>> {
  if (!viewerId || rows.length === 0) return new Set();

  const { data } = await supabase
    .from("likes")
    .select("log_user_id, log_video_id")
    .eq("user_id", viewerId)
    .in("log_video_id", rows.map((r) => r.video_id));

  return new Set(
    (data ?? []).map((r) => likeKey(r.log_user_id, r.log_video_id))
  );
}