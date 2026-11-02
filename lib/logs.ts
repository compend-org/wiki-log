import { createClient } from "@/lib/supabase/client";

export type Log = {
  id: string;
  itemId: string;
  title: string;
  imageUrl: string | null;
  rating: number;
  review: string;
  loggedAt: string;
};

type Row = {
  id: string;
  item_id: string;
  rating: number;
  review: string;
  logged_at: string;
  items: { title: string; image_url: string | null } | null;
};

// One user's entries, newest first
export async function readLogs(userId: string): Promise<Log[]> {
  const { data, error } = await createClient()
    .from("logs")
    .select("id, item_id, rating, review, logged_at, items(title, image_url)")
    .eq("user_id", userId)
    .order("logged_at", { ascending: false });
  if (error) {
    console.error("readLogs failed:", error.message);
    return [];
  }

  return ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.id,
    itemId: row.item_id,
    title: row.items?.title ?? "Unknown item",
    imageUrl: row.items?.image_url ?? null,
    rating: row.rating,
    review: row.review,
    loggedAt: row.logged_at,
  }));
}

// Returns an error message, or null on success (RLS limits both to your own)
export async function deleteLog(logId: string): Promise<string | null> {
  const { error } = await createClient().from("logs").delete().eq("id", logId);
  return error ? error.message : null;
}

export async function updateLog(
  logId: string,
  rating: number,
  review: string
): Promise<string | null> {
  const { error } = await createClient()
    .from("logs")
    .update({ rating, review: review.slice(0, 5000) })
    .eq("id", logId);
  return error ? error.message : null;
}