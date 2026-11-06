// ABOUTME: Looks up one person's review with its item, its comments, and its like and share counts.
// ABOUTME: Cached per request, so a page and its metadata share one lookup.
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type ReviewComment = {
  id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  user_id: string;
  profiles: { username: string } | null;
  comment_likes: { count: number }[];
};

export type Review = {
  id: string;
  user_id: string;
  item_id: string;
  rating: number | null;
  review: string;
  logged_at: string;
  items: {
    title: string;
    image_url: string | null;
    image_hidden: boolean;
  } | null;
  likes: { count: number }[];
  shares: { count: number }[];
  comments: ReviewComment[];
};

// The review with this id by this person, or null when there's no such review
export const getReview = cache(
  async (logId: string, userId: string): Promise<Review | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("logs")
      .select(
        "id, user_id, item_id, rating, review, logged_at, items(title, image_url, image_hidden), likes(count), shares(count), comments(id, parent_id, body, created_at, user_id, profiles!comments_user_id_profiles_fkey(username), comment_likes(count))",
      )
      .eq("id", logId)
      .eq("user_id", userId)
      .order("created_at", { referencedTable: "comments", ascending: true })
      // Embeds aren't capped by the API's row limit, so comments get it here
      .limit(1000, { referencedTable: "comments" })
      .maybeSingle();
    return data as unknown as Review | null;
  },
);
