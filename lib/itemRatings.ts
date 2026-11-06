// ABOUTME: Reads, in one request, everyone's latest rating of an item, its number of
// ABOUTME: logs and the signed-in viewer's own entries for it, counted over all of its logs.
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type ViewerEntry = {
  id: string;
  rating: number | null;
  review: string;
  logged_at: string;
};

type ItemRatingsRow = {
  ratings: { rating: number; people: number }[];
  log_count: number;
  viewer_entries: ViewerEntry[];
};

// `ratings` has one rating per person, their latest; `logCount` counts every
// log; `viewerEntries` is the viewer's own entries, newest first, and empty
// when signed out. Shared by an item page and its sections within one request,
// and never cached beyond it.
export const getItemRatings = cache(
  async (
    itemId: string,
  ): Promise<{
    ratings: number[];
    logCount: number;
    viewerEntries: ViewerEntry[];
  }> => {
    const supabase = await createClient();
    const { data } = await supabase.rpc("item_ratings", { p_item_id: itemId });
    const row = data as ItemRatingsRow | null;
    return {
      ratings: (row?.ratings ?? []).flatMap((r) =>
        Array<number>(r.people).fill(Number(r.rating)),
      ),
      logCount: row?.log_count ?? 0,
      viewerEntries: row?.viewer_entries ?? [],
    };
  },
);
