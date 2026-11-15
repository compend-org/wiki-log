// ABOUTME: Picks the most and least popular items of the last 24 hours.
// ABOUTME: The result is cached in the shared remote cache for all server instances.
import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/connection";
import { reportFailedResponses } from "@/lib/supabase/reportFailedResponses";
import { POSTS_CACHE_TAG } from "./cacheTags";

export type Pick = {
  itemId: string;
  title: string;
  imageUrl: string | null;
  nsfw: boolean;
  average: number;
  count: number;
};

export type DailyPicks = {
  popular: Pick | null;
  unpopular: Pick | null;
};

type PickRow = {
  kind: string;
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

// The best- and worst-rated items of the last 24 hours.
export async function getDailyPicks(): Promise<DailyPicks> {
  // The remote cache is shared by every server instance. A plain "use cache"
  // lives in one instance's memory, so each new instance would query again.
  "use cache: remote";
  // Recomputed about every 2 minutes (120 seconds), however many people load
  // the page in between. The numbers must be written out here as plain values.
  cacheLife({ stale: 60, revalidate: 120, expire: 600 });
  cacheTag(POSTS_CACHE_TAG);

  const none: DailyPicks = { popular: null, unpopular: null };

  const supabase = createClient(supabaseUrl(), supabasePublishableKey(), {
    global: { fetch: reportFailedResponses },
  });

  const { data, error } = await supabase.rpc("popular_picks");
  const rows = (data ?? []) as PickRow[];
  if (error || rows.length === 0) return none;

  const { data: itemData } = await supabase
    .from("items")
    .select("id, title, image_url, image_hidden, nsfw")
    .in(
      "id",
      rows.map((r) => r.item_id),
    );
  const items = new Map(((itemData ?? []) as ItemRow[]).map((i) => [i.id, i]));

  const toPick = (row: PickRow | undefined): Pick | null => {
    if (!row) return null;
    const item = items.get(row.item_id);
    if (!item) return null;
    return {
      itemId: item.id,
      title: item.title,
      imageUrl: item.image_hidden ? null : item.image_url,
      nsfw: item.nsfw,
      average: Number(row.avg_rating),
      count: Number(row.n),
    };
  };

  return {
    popular: toPick(rows.find((r) => r.kind === "popular")),
    unpopular: toPick(rows.find((r) => r.kind === "unpopular")),
  };
}
