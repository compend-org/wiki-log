import type { SupabaseClient } from "@supabase/supabase-js";
import { likeKey } from "@/lib/likes";

export type AlsoLikedEntry = {
  userId: string;
  username: string;
  avatarPath: string | null;
  rating: number;
};

// Keyed by likeKey(reviewerId, itemId): the reviews that reviewer has liked
// on that same item
export type AlsoLikedMap = Map<string, AlsoLikedEntry[]>;

export async function getAlsoLiked(
  supabase: SupabaseClient,
  rows: { user_id: string; item_id: string }[]
): Promise<AlsoLikedMap> {
  const result: AlsoLikedMap = new Map();
  if (rows.length === 0) return result;

  const wanted = new Set(rows.map((r) => likeKey(r.user_id, r.item_id)));
  const reviewerIds = [...new Set(rows.map((r) => r.user_id))];
  const itemIds = [...new Set(rows.map((r) => r.item_id))];

  // Reviews these people have liked, on the same items (newest like first)
  const { data: likeRows } = await supabase
    .from("likes")
    .select("user_id, log_user_id, log_item_id, created_at")
    .in("user_id", reviewerIds)
    .in("log_item_id", itemIds)
    .order("created_at", { ascending: false });

  // Keep only the pairs actually on screen (the query above is a cross product)
  const likes = (likeRows ?? []).filter((l) =>
    wanted.has(likeKey(l.user_id, l.log_item_id))
  );
  if (likes.length === 0) return result;

  const likedUserIds = [...new Set(likes.map((l) => l.log_user_id))];

  const [logsRes, profilesRes] = await Promise.all([
    supabase
      .from("logs")
      .select("user_id, item_id, rating")
      .in("user_id", likedUserIds)
      .in("item_id", itemIds),
    supabase
      .from("profiles")
      .select("id, username, avatar_path")
      .in("id", likedUserIds),
  ]);

  const ratings = new Map(
    (logsRes.data ?? []).map((l) => [
      likeKey(l.user_id, l.item_id),
      Number(l.rating),
    ])
  );
  const people = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));

  for (const l of likes) {
    const rating = ratings.get(likeKey(l.log_user_id, l.log_item_id));
    const person = people.get(l.log_user_id);
    if (rating === undefined || !person) continue;

    const key = likeKey(l.user_id, l.log_item_id);
    const list = result.get(key) ?? [];
    list.push({
      userId: person.id,
      username: person.username,
      avatarPath: person.avatar_path ?? null,
      rating,
    });
    result.set(key, list);
  }

  return result;
}