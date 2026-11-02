import type { SupabaseClient } from "@supabase/supabase-js";
import { likeKey } from "@/lib/likes";

export type AlsoLikedEntry = {
  logId: string;
  userId: string;
  username: string;
  avatarPath: string | null;
  rating: number;
};

// Keyed by likeKey(reviewerId, itemId): the entries that reviewer has liked on
// that same item, at most one per person
export type AlsoLikedMap = Map<string, AlsoLikedEntry[]>;

type Row = {
  id: string;
  user_id: string;
  item_id: string;
  rating: number;
  logged_at: string;
  likes: { user_id: string; created_at: string }[];
};

export async function getAlsoLiked(
  supabase: SupabaseClient,
  rows: { user_id: string; item_id: string }[]
): Promise<AlsoLikedMap> {
  const result: AlsoLikedMap = new Map();
  if (rows.length === 0) return result;

  const wanted = new Set(rows.map((r) => likeKey(r.user_id, r.item_id)));
  const reviewerIds = [...new Set(rows.map((r) => r.user_id))];
  const itemIds = [...new Set(rows.map((r) => r.item_id))];

  // Entries on these items that these people have liked
  const { data } = await supabase
    .from("logs")
    .select(
      "id, user_id, item_id, rating, logged_at, likes!inner(user_id, created_at)"
    )
    .in("item_id", itemIds)
    .in("likes.user_id", reviewerIds);

  const liked = (data ?? []) as unknown as Row[];
  if (liked.length === 0) return result;

  const ownerIds = [...new Set(liked.map((l) => l.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, avatar_path")
    .in("id", ownerIds);
  const people = new Map((profiles ?? []).map((p) => [p.id as string, p]));

  // One entry per person: if the reviewer liked several entries by the same
  // person, keep that person's most recently logged one
  const best = new Map<
    string,
    { key: string; likedAt: number; loggedAt: number; entry: AlsoLikedEntry }
  >();

  for (const log of liked) {
    const person = people.get(log.user_id);
    if (!person) continue;

    for (const like of log.likes) {
      const key = likeKey(like.user_id, log.item_id);
      if (!wanted.has(key)) continue;

      const slot = `${key}:${log.user_id}`;
      const loggedAt = new Date(log.logged_at).getTime();
      const current = best.get(slot);

      if (!current || loggedAt > current.loggedAt) {
        best.set(slot, {
          key,
          likedAt: new Date(like.created_at).getTime(),
          loggedAt,
          entry: {
            logId: log.id,
            userId: person.id,
            username: person.username,
            avatarPath: person.avatar_path ?? null,
            rating: Number(log.rating),
          },
        });
      }
    }
  }

  // Most recently liked first
  const found = [...best.values()].sort((a, b) => b.likedAt - a.likedAt);
  for (const f of found) {
    const list = result.get(f.key) ?? [];
    list.push(f.entry);
    result.set(f.key, list);
  }
  return result;
}