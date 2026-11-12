// ABOUTME: Reads, in one request, everyone's latest rating of an item, its number of
// ABOUTME: logs and the signed-in viewer's own entries for it, counted over all of its logs.
import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";

type ViewerEntry = {
  id: string;
  rating: number | null;
  review: string;
  // Paths of its image in the post-images bucket
  images: string[];
  images_checked_at: string | null;
  logged_at: string;
};

type ItemRatingsRow = {
  ratings: { rating: number; people: number }[];
  log_count: number;
  viewer_entries: ViewerEntry[];
};

type ItemRatings = {
  ratings: number[];
  logCount: number;
  viewerEntries: ViewerEntry[];
};

// `ratings` has one rating per person, their latest; `logCount` counts every
// log; `viewerEntries` is the viewer's own entries, newest first, and empty
// when signed out. What it counts depends on who `supabase` reads as.
async function readItemRatings(
  supabase: SupabaseClient,
  itemId: string,
): Promise<ItemRatings> {
  const { data } = await supabase.rpc("item_ratings", { p_item_id: itemId });
  const row = data as ItemRatingsRow | null;
  return {
    ratings: (row?.ratings ?? []).flatMap((r) =>
      Array<number>(r.people).fill(Number(r.rating)),
    ),
    logCount: row?.log_count ?? 0,
    viewerEntries: row?.viewer_entries ?? [],
  };
}

// The item's ratings as the signed-in viewer sees them. Shared by an item
// page and its sections within one request, and never cached beyond it.
export const getItemRatings = cache(
  async (itemId: string): Promise<ItemRatings> =>
    readItemRatings(await createClient(), itemId),
);

// Everyone's latest rating of the item, one per person, as an anonymous
// visitor sees them: the same for every viewer, so safe to cache and share
export async function getPublicItemRatings(itemId: string): Promise<number[]> {
  const { ratings } = await readItemRatings(createPublicClient(), itemId);
  return ratings;
}
