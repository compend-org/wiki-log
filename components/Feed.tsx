import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLikedSet, likeKey } from "@/lib/likes";
import { commentLabel } from "@/lib/format";
import { PAGE_SIZE } from "@/lib/paging";
import LikeButton from "@/components/LikeButton";
import ListLikeButton from "@/components/ListLikeButton";
import LoadMore from "@/components/LoadMore";
import ItemImage from "@/components/ItemImage";
import Stars from "@/components/Stars";

type Tab = "following" | "everyone";

type LogRow = {
    user_id: string;
    item_id: string;
    rating: number;
    review: string;
    logged_at: string;
    items: { title: string; image_url: string | null } | null;
    profiles: { username: string } | null;
    likes: { count: number }[];
    comments: { count: number }[];
};

type ListRow = {
    id: string;
    user_id: string;
    title: string;
    ranked: boolean;
    created_at: string;
    profiles: { username: string } | null;
    list_items: { count: number }[];
    list_likes: { count: number }[];
    list_comments: { count: number }[];
};

type PreviewRow = {
    list_id: string;
    position: number;
    items: { title: string; image_url: string | null } | null;
};

type Entry =
    | { kind: "log"; date: string; log: LogRow }
    | { kind: "list"; date: string; list: ListRow };

export default async function Feed({
    tab,
    limit = PAGE_SIZE,
}: {
    tab?: Tab;
    limit?: number;
}) {
    await connection();
    const supabase = await createClient();

    const { data: claimsData } = await supabase.auth.getClaims();
    const viewerId: string | undefined = claimsData?.claims?.sub;

    // Signed-in visitors start on Following, signed-out ones on Everyone
    const active: Tab = tab ?? (viewerId ? "following" : "everyone");

    let followingIds: string[] = [];
    if (active === "following" && viewerId) {
        const { data: followRows } = await supabase
            .from("follows")
            .select("following_id")
            .eq("follower_id", viewerId);
        followingIds = (followRows ?? []).map((r) => r.following_id);
    }

    let entries: Entry[] = [];
    let hasMore = false;
    let errorMessage = "";
    let likedSet = new Set<string>();
    let likedLists = new Set<string>();
    const previews = new Map<
        string,
        { title: string; image_url: string | null }[]
    >();

    if (active === "everyone" || followingIds.length > 0) {
        let logQuery = supabase
            .from("logs")
            .select(
                "user_id, item_id, rating, review, logged_at, items(title, image_url), profiles!logs_user_id_profiles_fkey(username), likes(count), comments(count)"
            )
            .order("logged_at", { ascending: false })
            .limit(limit + 1);
        let listQuery = supabase
            .from("lists")
            .select(
                "id, user_id, title, ranked, created_at, profiles!lists_user_id_profiles_fkey(username), list_items(count), list_likes(count), list_comments(count)"
            )
            .order("created_at", { ascending: false })
            .limit(limit + 1);
        if (active === "following") {
            logQuery = logQuery.in("user_id", followingIds);
            listQuery = listQuery.in("user_id", followingIds);
        }

        const [logsRes, listsRes] = await Promise.all([logQuery, listQuery]);
        if (logsRes.error) errorMessage = logsRes.error.message;
        else if (listsRes.error) errorMessage = listsRes.error.message;

        const logs = (logsRes.data ?? []) as unknown as LogRow[];
        // Empty lists stay out of the feed until they have something in them
        const lists = ((listsRes.data ?? []) as unknown as ListRow[]).filter(
            (l) => (l.list_items?.[0]?.count ?? 0) > 0
        );

        // The newest `limit` of the combined list always sit within the newest
        // `limit` of each, so merging and trimming is exact
        const merged: Entry[] = [
            ...logs.map((log): Entry => ({ kind: "log", date: log.logged_at, log })),
            ...lists.map(
                (list): Entry => ({ kind: "list", date: list.created_at, list })
            ),
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        hasMore = merged.length > limit;
        entries = merged.slice(0, limit);

        const shownLogs = entries.flatMap((e) => (e.kind === "log" ? [e.log] : []));
        const shownLists = entries.flatMap((e) =>
            e.kind === "list" ? [e.list] : []
        );

        likedSet = await getLikedSet(supabase, viewerId, shownLogs);

        if (shownLists.length > 0) {
            const ids = shownLists.map((l) => l.id);

            const { data: previewData } = await supabase
                .from("list_items")
                .select("list_id, position, items(title, image_url)")
                .in("list_id", ids)
                .lte("position", 4)
                .order("position");
            for (const row of (previewData ?? []) as unknown as PreviewRow[]) {
                const arr = previews.get(row.list_id) ?? [];
                arr.push({
                    title: row.items?.title ?? "Unknown item",
                    image_url: row.items?.image_url ?? null,
                });
                previews.set(row.list_id, arr);
            }

            if (viewerId) {
                const { data: likedRows } = await supabase
                    .from("list_likes")
                    .select("list_id")
                    .eq("user_id", viewerId)
                    .in("list_id", ids);
                likedLists = new Set((likedRows ?? []).map((r) => r.list_id));
            }
        }
    }

    const needsSignIn = active === "following" && !viewerId;
    const noFollows =
        active === "following" && Boolean(viewerId) && followingIds.length === 0;

    return (
        <section className="flex flex-col gap-4">
            <div className="flex border-b border-line">
                {(["following", "everyone"] as const).map((t) => (
                    <Link
                        key={t}
                        href={`/?tab=${t}`}
                        scroll={false}
                        className={`-mb-px flex-1 border-b-2 px-4 py-3 text-center ${active === t
                                ? "border-accent text-foreground"
                                : "border-transparent text-muted"
                            }`}
                    >
                        {t === "following" ? "Following" : "Everyone"}
                    </Link>
                ))}
            </div>

            {needsSignIn && (
                <p className="text-muted">
                    <Link href="/login" className="underline">
                        Sign in
                    </Link>{" "}
                    to follow people and see what they log here.
                </p>
            )}

            {noFollows && (
                <p className="text-muted">
                    You&apos;re not following anyone yet. Find people on the{" "}
                    <Link href="/search" className="underline">
                        Search page
                    </Link>{" "}
                    and follow them to fill this feed, or switch to Everyone.
                </p>
            )}

            {errorMessage && <p className="text-danger">{errorMessage}</p>}

            {!needsSignIn &&
                !noFollows &&
                !errorMessage &&
                entries.length === 0 && (
                    <p className="text-muted">
                        {active === "following"
                            ? "Nothing from the people you follow yet."
                            : "Nothing here yet."}
                    </p>
                )}

            {entries.map((entry) => {
                if (entry.kind === "list") {
                    const l = entry.list;
                    const author = l.profiles?.username;
                    const preview = previews.get(l.id) ?? [];
                    const itemCount = l.list_items?.[0]?.count ?? 0;

                    return (
                        <div
                            key={`list-${l.id}`}
                            className="card relative flex flex-col gap-2 p-3 hover:border-accent/60"
                        >
                            <Link
                                href={`/list/${l.id}`}
                                aria-label={`Open the list ${l.title}`}
                                className="absolute inset-0 rounded-[inherit]"
                            />
                            <span className="text-sm text-muted">
                                {author ? (
                                    <Link
                                        href={`/u/${encodeURIComponent(author)}`}
                                        className="relative z-10 underline"
                                    >
                                        {author}
                                    </Link>
                                ) : (
                                    "Someone"
                                )}{" "}
                                made a {l.ranked ? "ranked " : ""}list
                            </span>
                            <span className="font-semibold">{l.title}</span>
                            {preview.length > 0 && (
                                <div className="flex gap-1">
                                    {preview.map((p, i) => (
                                        <ItemImage
                                            key={i}
                                            src={p.image_url}
                                            alt={p.title}
                                            className="h-14 w-14 rounded"
                                        />
                                    ))}
                                </div>
                            )}
                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                                <span>
                                    {new Date(l.created_at).toLocaleDateString()} · {itemCount}{" "}
                                    {itemCount === 1 ? "item" : "items"}
                                </span>
                                <span className="relative z-10">
                                    <ListLikeButton
                                        viewerId={viewerId ?? null}
                                        listId={l.id}
                                        ownerId={l.user_id}
                                        initialCount={l.list_likes?.[0]?.count ?? 0}
                                        initiallyLiked={likedLists.has(l.id)}
                                    />
                                </span>
                                <Link
                                    href={`/list/${l.id}#comments`}
                                    className="relative z-10 underline"
                                >
                                    {commentLabel(l.list_comments?.[0]?.count ?? 0)}
                                </Link>
                            </div>
                        </div>
                    );
                }

                const row = entry.log;
                const title = row.items?.title ?? "Unknown item";
                const author = row.profiles?.username;
                const reviewHref = author
                    ? `/u/${encodeURIComponent(author)}/${row.item_id}`
                    : null;

                return (
                    <div
                        key={`log-${row.user_id}-${row.item_id}`}
                        className={`card relative grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 p-3 hover:border-accent/60 ${row.review
                                ? "sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.2fr)]"
                                : ""
                            }`}
                    >
                        {reviewHref && (
                            <Link
                                href={reviewHref}
                                aria-label={`Open ${author}'s review of ${title}`}
                                className="absolute inset-0 rounded-[inherit]"
                            />
                        )}

                        <Link
                            href={`/item/${row.item_id}`}
                            className="relative z-10 shrink-0 self-center"
                        >
                            <ItemImage
                                src={row.items?.image_url}
                                alt={title}
                                className="h-20 w-20 rounded"
                            />
                        </Link>

                        <div className="flex min-w-0 flex-col gap-1">
                            <span className="text-sm text-muted">
                                {author ? (
                                    <Link
                                        href={`/u/${encodeURIComponent(author)}`}
                                        className="relative z-10 underline"
                                    >
                                        {author}
                                    </Link>
                                ) : (
                                    "Someone"
                                )}{" "}
                                logged
                            </span>
                            <Link
                                href={`/item/${row.item_id}`}
                                className="relative z-10 w-fit font-semibold"
                            >
                                {title}
                            </Link>
                            <Stars rating={row.rating} />
                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                                <span>{new Date(row.logged_at).toLocaleDateString()}</span>
                                {row.review && (
                                    <span className="relative z-10">
                                        <LikeButton
                                            viewerId={viewerId ?? null}
                                            authorId={row.user_id}
                                            itemId={row.item_id}
                                            initialCount={row.likes?.[0]?.count ?? 0}
                                            initiallyLiked={likedSet.has(
                                                likeKey(row.user_id, row.item_id)
                                            )}
                                        />
                                    </span>
                                )}
                                {reviewHref && (
                                    <Link href={reviewHref} className="relative z-10 underline">
                                        {commentLabel(row.comments?.[0]?.count ?? 0)}
                                    </Link>
                                )}
                            </div>
                        </div>

                        {row.review && (
                            <p className="col-span-2 line-clamp-6 whitespace-pre-wrap break-words text-sm sm:col-span-1 sm:border-l sm:border-dashed sm:border-line sm:pl-4">
                                {row.review}
                            </p>
                        )}
                    </div>
                );
            })}

            {hasMore && <LoadMore href={`/?tab=${active}&limit=${limit + PAGE_SIZE}`} />}
        </section>
    );
}