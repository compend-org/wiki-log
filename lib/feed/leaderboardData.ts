// ABOUTME: Loads one leaderboard: the top items of its types, with their titles and images.
// ABOUTME: The same for every visitor, so it is cached in the shared remote cache for a while.
import { cacheLife, cacheTag } from "next/cache";
import { POSTS_CACHE_TAG } from "@/lib/cacheTags";
import {
  DEFAULT_MIN_RATINGS,
  LEADERBOARD_SIZE,
  LEADERBOARDS,
} from "@/lib/leaderboards";
import { createPublicClient } from "@/lib/supabase/public";

export type LeaderboardEntry = {
  itemId: string;
  title: string;
  imageUrl: string | null;
  nsfw: boolean;
  average: number;
  count: number;
};

type RankRow = {
  item_id: string;
  avg_rating: number | string;
  n: number | string;
};

type ItemRow = {
  id: string;
  title: string;
  image_url: string | null;
  image_hidden: boolean;
  nsfw: boolean;
};

// The ranked items of the leaderboard with this slug, best first. Null if
// there is no such leaderboard.
export async function getLeaderboard(
  slug: string,
): Promise<{ entries: LeaderboardEntry[]; error: string } | null> {
  "use cache: remote";
  // Recomputed about every 15 minutes, however many people look in between
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });
  cacheTag(POSTS_CACHE_TAG);

  const board = LEADERBOARDS.find((b) => b.slug === slug);
  if (!board) return null;

  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("leaderboard", {
    p_types: board.types,
    p_min: board.minRatings ?? DEFAULT_MIN_RATINGS,
    p_limit: LEADERBOARD_SIZE,
  });
  const rows = (data ?? []) as RankRow[];
  if (error || rows.length === 0) {
    return { entries: [], error: error?.message ?? "" };
  }

  const { data: itemData } = await supabase
    .from("items")
    .select("id, title, image_url, image_hidden, nsfw")
    .in(
      "id",
      rows.map((r) => r.item_id),
    );
  const items = new Map(((itemData ?? []) as ItemRow[]).map((i) => [i.id, i]));

  const entries: LeaderboardEntry[] = [];
  for (const row of rows) {
    const item = items.get(row.item_id);
    if (!item) continue;
    entries.push({
      itemId: item.id,
      title: item.title,
      imageUrl: item.image_hidden ? null : item.image_url,
      nsfw: item.nsfw,
      average: Number(row.avg_rating),
      count: Number(row.n),
    });
  }
  return { entries, error: "" };
}
