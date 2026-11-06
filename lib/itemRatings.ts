// ABOUTME: Reads, in one request, everyone's latest rating of an item and the
// ABOUTME: signed-in viewer's own entries for it, counted over all of its logs.
import type { SupabaseClient } from "@supabase/supabase-js";

export type ViewerEntry = {
  id: string;
  rating: number | null;
  review: string;
  logged_at: string;
};

type ItemRatingsRow = {
  ratings: { rating: number; people: number }[];
  viewer_entries: ViewerEntry[];
};

// `ratings` has one rating per person, their latest; `viewerEntries` is the
// viewer's own entries, newest first, and empty when signed out. Different for
// each viewer, so never cached.
export async function getItemRatings(
  supabase: SupabaseClient,
  itemId: string,
): Promise<{ ratings: number[]; viewerEntries: ViewerEntry[] }> {
  const { data } = await supabase.rpc("item_ratings", { p_item_id: itemId });
  const row = data as ItemRatingsRow | null;
  return {
    ratings: (row?.ratings ?? []).flatMap((r) =>
      Array<number>(r.people).fill(Number(r.rating)),
    ),
    viewerEntries: row?.viewer_entries ?? [],
  };
}
