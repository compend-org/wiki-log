import { createClient } from "@/lib/supabase/client";

// Returns an error message, or null on success (RLS limits both to your own)
export async function deleteLog(logId: string): Promise<string | null> {
  const { error } = await createClient().from("logs").delete().eq("id", logId);
  return error ? error.message : null;
}

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
