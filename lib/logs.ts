// ABOUTME: Changes to your own logs, made from the browser.
// ABOUTME: Returns an error message, or null on success.
import { createClient } from "@/lib/supabase/client";

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
