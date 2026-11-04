import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cacheLife } from "next/cache";
import { TRENDING_HOURS } from "@/lib/site";

export type LogRow = {
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
};

export type ListRow = {
  id: string;
  user_id: string;
  title: string;
  ranked: boolean;
  created_at: string;
  profiles: { username: string; avatar_path: string | null } | null;
  list_items: { count: number }[];
  list_likes: { count: number }[];
  list_comments: { count: number }[];
};

export type Thumb = { title: string; image_url: string | null };

export type PublicFeed = {
  logs: LogRow[];
  lists: ListRow[];
  // Keyed by list id, the first few items of each list
  previews: Record<string, Thumb[]>;
  // Keyed by log or list id, the likes counted for Trending (empty otherwise)
  scores: Record<string, number>;
  error: string;
};

type PreviewRow = {
  list_id: string;
  position: number;
  items: Thumb | null;
};

type RankRow = { row_id: string; recent_likes: number | string };

const LOG_SELECT =
  "id, user_id, item_id, rating, review, logged_at, items(title, image_url), profiles!logs_user_id_profiles_fkey(username, avatar_path), likes(count), comments(count)";
export const LIST_SELECT =
  "id, user_id, title, ranked, created_at, profiles!lists_user_id_profiles_fkey(username, avatar_path), list_items(count), list_likes(count), list_comments(count)";

function publicClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}

// Empty lists stay out of the feed until they have something in them
function nonEmpty(lists: ListRow[]): ListRow[] {
  return lists.filter((l) => (l.list_items?.[0]?.count ?? 0) > 0);
}

// The first few items of each list that can be shown
export async function loadPreviews(
  supabase: SupabaseClient,
  lists: ListRow[],
): Promise<Record<string, Thumb[]>> {
  const previews: Record<string, Thumb[]> = {};
  if (lists.length === 0) return previews;

  const { data } = await supabase
    .from("list_items")
    .select("list_id, position, items(title, image_url)")
    .in(
      "list_id",
      lists.map((l) => l.id),
    )
    .lte("position", 12)
    .order("position");
  for (const row of (data ?? []) as unknown as PreviewRow[]) {
    const arr = previews[row.list_id] ?? [];
    arr.push({
      title: row.items?.title ?? "Unknown item",
      image_url: row.items?.image_url ?? null,
    });
    previews[row.list_id] = arr;
  }
  return previews;
}

// The Everyone feed: the same for every visitor, so it is computed once a
// minute and shared. Each viewer's own hearts are looked up separately.
export async function getPublicFeed(limit: number): Promise<PublicFeed> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });

  const supabase = publicClient();

  const [logsRes, listsRes] = await Promise.all([
    supabase
      .from("logs")
      .select(LOG_SELECT)
      .order("logged_at", { ascending: false })
      .limit(limit + 1),
    supabase
      .from("lists")
      .select(LIST_SELECT)
      .order("created_at", { ascending: false })
      .limit(limit + 1),
  ]);

  const error = logsRes.error?.message ?? listsRes.error?.message ?? "";
  const logs = (logsRes.data ?? []) as unknown as LogRow[];
  const lists = nonEmpty((listsRes.data ?? []) as unknown as ListRow[]);
  const previews = await loadPreviews(supabase, lists.slice(0, limit));

  return { logs, lists, previews, scores: {}, error };
}

// The Trending feed: what was liked most in the last TRENDING_HOURS hours.
// Also the same for every visitor, so also cached for a minute.
export async function getTrendingFeed(limit: number): Promise<PublicFeed> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });

  const supabase = publicClient();

  const [logRank, listRank] = await Promise.all([
    supabase.rpc("trending_logs", {
      p_hours: TRENDING_HOURS,
      p_limit: limit + 1,
    }),
    supabase.rpc("trending_lists", {
      p_hours: TRENDING_HOURS,
      p_limit: limit + 1,
    }),
  ]);

  const scores: Record<string, number> = {};
  const logIds: string[] = [];
  const listIds: string[] = [];
  for (const row of (logRank.data ?? []) as RankRow[]) {
    logIds.push(row.row_id);
    scores[row.row_id] = Number(row.recent_likes);
  }
  for (const row of (listRank.data ?? []) as RankRow[]) {
    listIds.push(row.row_id);
    scores[row.row_id] = Number(row.recent_likes);
  }

  const rankError = logRank.error?.message ?? listRank.error?.message ?? "";
  if (logIds.length === 0 && listIds.length === 0) {
    return { logs: [], lists: [], previews: {}, scores, error: rankError };
  }

  const logsRes =
    logIds.length > 0
      ? await supabase.from("logs").select(LOG_SELECT).in("id", logIds)
      : { data: [], error: null };
  const listsRes =
    listIds.length > 0
      ? await supabase.from("lists").select(LIST_SELECT).in("id", listIds)
      : { data: [], error: null };

  const score = (id: string) => scores[id] ?? 0;
  // Most likes first, and newer first when they are tied
  const logs = ((logsRes.data ?? []) as unknown as LogRow[]).sort(
    (a, b) =>
      score(b.id) - score(a.id) ||
      new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime(),
  );
  const lists = nonEmpty((listsRes.data ?? []) as unknown as ListRow[]).sort(
    (a, b) =>
      score(b.id) - score(a.id) ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const previews = await loadPreviews(supabase, lists.slice(0, limit));

  return {
    logs,
    lists,
    previews,
    scores,
    error:
      rankError || (logsRes.error?.message ?? listsRes.error?.message ?? ""),
  };
}
