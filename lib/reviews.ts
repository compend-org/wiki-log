// ABOUTME: Looks up one person's review with its item and its like and share counts, optionally with its comments.
// ABOUTME: Cached per request, so a page and its metadata share one lookup.
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type ReviewComment = {
  id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  user_id: string;
  // Only ever set on the viewer's own comments: other removed ones are hidden
  removed_at: string | null;
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

export type ReviewWithComments = Review & { comments: ReviewComment[] };

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

// The same review with its comments, oldest first
export const getReviewWithComments = cache(
  async (logId: string, userId: string): Promise<ReviewWithComments | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("logs")
      .select(
        `${REVIEW_COLUMNS}, comments(id, parent_id, body, created_at, user_id, removed_at, profiles!comments_user_id_profiles_fkey(username), comment_likes(count))`,
      )
      .eq("id", logId)
      .eq("user_id", userId)
      .order("created_at", { referencedTable: "comments", ascending: true })
      // Embeds aren't capped by the API's row limit, so comments get it here
      .limit(1000, { referencedTable: "comments" })
      .maybeSingle();
    return data as unknown as ReviewWithComments | null;
  },
);
