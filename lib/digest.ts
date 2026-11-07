// ABOUTME: Loads the newest long reviews for the Digest page, a page at a time.
// ABOUTME: The same for every visitor, so the result is cached in the shared remote cache.
import { cacheLife, cacheTag } from "next/cache";
import { POSTS_CACHE_TAG } from "@/lib/cacheTags";
import { createPublicClient } from "@/lib/supabase/public";

// A review counts as long above 720 characters. That number lives in the
// long_logs() function and its index in the database, so change it there too.
export const DIGEST_PAGE_SIZE = 20;

export type DigestLog = {
  id: string;
  user_id: string;
  item_id: string;
  rating: number | null;
  review: string;
  logged_at: string;
  items: { title: string; image_url: string | null } | null;
  profiles: { username: string; avatar_path: string | null } | null;
  likes: { count: number }[];
  comments: { count: number }[];
  shares: { count: number }[];
};

const SELECT =
  "id, user_id, item_id, rating, review, logged_at, items(title, image_url), profiles!logs_user_id_profiles_fkey(username, avatar_path), likes(count), comments(count), shares(count)";

// Where the next page starts: the time of the last review shown. Null means
// the first page. Anything that isn't a real time is turned away (undefined).
export function parseDigestCursor(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    return undefined;
  }
  return value;
}

// The long reviews posted before `before`, newest first. One extra row is
// fetched to tell whether there is an older page; `next` is where it starts.
export async function getDigest(
  before: string | null,
): Promise<{ logs: DigestLog[]; next: string | null; error: string }> {
  "use cache: remote";
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });
  cacheTag(POSTS_CACHE_TAG);

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .rpc("long_logs", { p_before: before, p_limit: DIGEST_PAGE_SIZE + 1 })
    .select(SELECT);

  const rows = (data ?? []) as unknown as DigestLog[];
  const logs = rows.slice(0, DIGEST_PAGE_SIZE);
  const hasMore = rows.length > DIGEST_PAGE_SIZE;
  return {
    logs,
    next: hasMore ? (logs[logs.length - 1]?.logged_at ?? null) : null,
    error: error?.message ?? "",
  };
}
