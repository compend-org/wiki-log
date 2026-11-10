// ABOUTME: Looks up one person's review with its item and its like and share counts.
// ABOUTME: Cached per request, so a page and its metadata share one lookup.
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Review = {
  id: string;
  user_id: string;
  item_id: string;
  rating: number | null;
  review: string;
  logged_at: string;
  // Only ever set for the author: removed reviews are hidden from everyone else
  removed_at: string | null;
  items: {
    title: string;
    image_url: string | null;
    image_hidden: boolean;
  } | null;
  likes: { count: number }[];
  shares: { count: number }[];
};

const REVIEW_COLUMNS =
  "id, user_id, item_id, rating, review, logged_at, removed_at, items(title, image_url, image_hidden), likes(count), shares(count)";

// The review with this id by this person, or null when there's no such review
export const getReview = cache(
  async (logId: string, userId: string): Promise<Review | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("logs")
      .select(REVIEW_COLUMNS)
      .eq("id", logId)
      .eq("user_id", userId)
      .maybeSingle();
    return data as unknown as Review | null;
  },
);
