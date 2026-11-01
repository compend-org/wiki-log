  import { createClient } from "@/lib/supabase/client";

export type Log = {
  id: string;
  title: string;
  rating: number;
  review: string;
  loggedAt: string;
};

// One user's log for one video, or null
export async function readLog(
  videoId: string,
  userId: string
): Promise<{ rating: number; review: string } | null> {
  const { data } = await createClient()
    .from("logs")
    .select("rating, review")
    .eq("video_id", videoId)
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? null;
}

// One user's logs, newest first
export async function readLogs(userId: string): Promise<Log[]> {
  const { data, error } = await createClient()
    .from("logs")
    .select("video_id, rating, review, logged_at, videos(title)")
    .eq("user_id", userId)
    .order("logged_at", { ascending: false });
  if (error) {
    console.error("readLogs failed:", error.message);
    return [];
  }
  if (!data) return [];

  return data.map((row) => {
    const video = row.videos as unknown as { title: string } | null;
    return {
      id: row.video_id,
      title: video?.title ?? "Unknown video",
      rating: row.rating,
      review: row.review,
      loggedAt: row.logged_at,
    };
  });
}

// Returns an error message, or null on success (RLS limits this to your own logs)
export async function deleteLog(videoId: string): Promise<string | null> {
  const { error } = await createClient()
    .from("logs")
    .delete()
    .eq("video_id", videoId);
  return error ? error.message : null;
}