import { createClient } from "@supabase/supabase-js";
import { cacheLife } from "next/cache";

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
    error: string;
};

type PreviewRow = {
    list_id: string;
    position: number;
    items: Thumb | null;
};

// The Everyone feed: the same for every visitor, so it is computed once a
// minute and shared. Each viewer's own hearts are looked up separately.
export async function getPublicFeed(limit: number): Promise<PublicFeed> {
    "use cache";
    cacheLife({ stale: 30, revalidate: 60, expire: 300 });

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    );

    const [logsRes, listsRes] = await Promise.all([
        supabase
            .from("logs")
            .select(
                "id, user_id, item_id, rating, review, logged_at, items(title, image_url), profiles!logs_user_id_profiles_fkey(username, avatar_path), likes(count), comments(count)"
            )
            .order("logged_at", { ascending: false })
            .limit(limit + 1),
        supabase
            .from("lists")
            .select(
                "id, user_id, title, ranked, created_at, profiles!lists_user_id_profiles_fkey(username, avatar_path), list_items(count), list_likes(count), list_comments(count)"
            )
            .order("created_at", { ascending: false })
            .limit(limit + 1),
    ]);

    const error = logsRes.error?.message ?? listsRes.error?.message ?? "";
    const logs = (logsRes.data ?? []) as unknown as LogRow[];
    // Empty lists stay out of the feed until they have something in them
    const lists = ((listsRes.data ?? []) as unknown as ListRow[]).filter(
        (l) => (l.list_items?.[0]?.count ?? 0) > 0
    );

    // The first few items of each list that can be shown
    const previews: Record<string, Thumb[]> = {};
    const shownLists = lists.slice(0, limit);
    if (shownLists.length > 0) {
        const { data } = await supabase
            .from("list_items")
            .select("list_id, position, items(title, image_url)")
            .in(
                "list_id",
                shownLists.map((l) => l.id)
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
    }

    return { logs, lists, previews, error };
}