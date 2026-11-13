import { createClient } from "@/lib/supabase/client";

// Returns an error message, or null on success (RLS limits it to your own)
export async function updateLog(
  logId: string,
  rating: number | null,
  review: string,
): Promise<string | null> {
  const { error } = await createClient()
    .from("logs")
    .update({ rating, review: review.slice(0, 5000) })
    .eq("id", logId);
  return error ? error.message : null;
}
