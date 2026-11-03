import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLikedSet } from "@/lib/likes";
import { commentLabel } from "@/lib/format";
import { PAGE_SIZE } from "@/lib/paging";
import { TRENDING_HOURS } from "@/lib/site";
import {
    getPublicFeed,
    getTrendingFeed,
    type ListRow,
    type LogRow,
    type Thumb,
} from "@/lib/feedData";
import Avatar from "@/components/Avatar";
import LikeButton from "@/components/LikeButton";
import ListLikeButton from "@/components/ListLikeButton";
import LoadMore from "@/components/LoadMore";
import ItemImage from "@/components/ItemImage";
import Stars from "@/components/Stars";
import ListPreview from "@/components/ListPreview";

type Mode = "following" | "everyone" | "trending";

type PreviewRow = {
    list_id: string;
    position: number;
    items: Thumb | null;
};

type Entry =
    | { kind: "log"; date: string; log: LogRow }
    | { kind: "list"; date: string; list: ListRow };

export default async function Feed({
    mode,
    limit = PAGE_SIZE,
}: {
    mode: Mode;
    limit?: number;
}) {
    await connection();
    const supabase = await createClient();

    const { data: claimsData } = await supabase.auth.getClaims();
    const viewerId: string | undefined = claimsData?.claims?.sub;

    // Following shows the people you follow and you, so your own entries are in
    // it as well
    let followedCount = 0;
    let authorIds: string[] = [];
    if (mode === "following" && viewerId) {
        const { data: followRows } = await supabase
            .from("follows")
            .select("following_id")
            .eq("follower_id", viewerId);
        const followed = (followRows ?? []).map((r) => r.following_id as string);
        followedCount = followed.length;
        authorIds = [...new Set([...followed, viewerId])];
    }

    let entries: Entry[] = [];
    let reviewEntries: Entry[] = [];
    let listEntries: Entry[] = [];
    let hasMore = false;
    let errorMessage = "";
    let likedSet = new Set<string>();
    let likedLists = new Set<string>();
    let scores: Record<string, number> = {};
    const previews = new Map<string, Thumb[]>();

    if (mode !== "following" || authorIds.length > 0) {
        let logs: LogRow[] = [];
        let lists: ListRow[] = [];

        if (mode === "following") {
            const [logsRes, listsRes] = await Promise.all([
                supabase
                    .from("logs")
                    .select(
                        "id, user_id, item_id, rating, review, logged_at, items(title, image_url), profiles!logs_user_id_profiles_fkey(username, avatar_path), likes(count), comments(count)"
                    )
                    .in("user_id", authorIds)
                    .order("logged_at", { ascending: false })
                    .limit(limit + 1),
                supabase
                    .from("lists")
                    .select(
                        "id, user_id, title, ranked, created_at, profiles!lists_user_id_profiles_fkey(username, avatar_path), list_items(count), list_likes(count), list_comments(count)"
                    )
                    .in("user_id", authorIds)
                    .order("created_at", { ascending: false })
                    .limit(limit + 1),
            ]);
            if (logsRes.error) errorMessage = logsRes.error.message;
            else if (listsRes.error) errorMessage = listsRes.error.message;

            logs = (logsRes.data ?? []) as unknown as LogRow[];
            // Empty lists stay out of the feed until they have something in them
            lists = ((listsRes.data ?? []) as unknown as ListRow[]).filter(
                (l) => (l.list_items?.[0]?.count ?? 0) > 0
            );
        } else {
            // Everyone and Trending are the same for every visitor, so they are
            // cached and shared. The viewer's own hearts are looked up below.
            const pub =
                mode === "trending"
                    ? await getTrendingFeed(limit)
                    : await getPublicFeed(limit);
            logs = pub.logs;
            lists = pub.lists;
            scores = pub.scores;
            errorMessage = pub.error;
            for (const [id, thumbs] of Object.entries(pub.previews)) {
                previews.set(id, thumbs);
            }
        }

        // The newest `limit` of the combined list always sit within the newest
        // `limit` of each, so merging and trimming is exact. Trending goes by
        // likes instead of by date.
        const entryId = (e: Entry) => (e.kind === "log" ? e.log.id : e.list.id);
        const merged: Entry[] = [
            ...logs.map((log): Entry => ({ kind: "log", date: log.logged_at, log })),
            ...lists.map(
                (list): Entry => ({ kind: "list", date: list.created_at, list })
            ),
        ].sort((a, b) => {
            const byDate =
                new Date(b.date).getTime() - new Date(a.date).getTime();
            return mode === "trending"
                ? (scores[entryId(b)] ?? 0) - (scores[entryId(a)] ?? 0) || byDate
                : byDate;
        });

        hasMore = merged.length > limit;
        entries = merged.slice(0, limit);

        // The wide layout has a column for each kind, so each gets its own top
        // `limit`. A busy stream of reviews can't push every list out.
        const shownLogs = logs.slice(0, limit);
        const shownLists = lists.slice(0, limit);
        reviewEntries = shownLogs.map(
            (log): Entry => ({ kind: "log", date: log.logged_at, log })
        );
        listEntries = shownLists.map(
            (list): Entry => ({ kind: "list", date: list.created_at, list })
        );

        // Which of these the viewer has liked: different for each person, so
        // never cached
        likedSet = await getLikedSet(supabase, viewerId, shownLogs);

        if (shownLists.length > 0) {
            const ids = shownLists.map((l) => l.id);

            // Everyone's and Trending's previews came with the cached data
            if (mode === "following") {
                const { data: previewData } = await supabase
                    .from("list_items")
                    .select("list_id, position, items(title, image_url)")
                    .in("list_id", ids)
                    .lte("position", 12)
                    .order("position");
                for (const row of (previewData ?? []) as unknown as PreviewRow[]) {
                    const arr = previews.get(row.list_id) ?? [];
                    arr.push({
                        title: row.items?.title ?? "Unknown item",
                        image_url: row.items?.image_url ?? null,
                    });
                    previews.set(row.list_id, arr);
                }
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

    const needsSignIn = mode === "following" && !viewerId;
    const noFollows =
        mode === "following" && Boolean(viewerId) && followedCount === 0;

    // The two kinds of card. Their layout follows the width of the column they
    // sit in (the "@xl:" variants), not the width of the screen.
    const renderList = (l: ListRow) => {
        const author = l.profiles?.username;
        const avatarPath = l.profiles?.avatar_path ?? null;
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
                <span className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
                    {author ? (
                        <Link
                            href={`/u/${encodeURIComponent(author)}`}
                            className="relative z-10 inline-flex items-center gap-1.5 underline"
                        >
                            <Avatar name={author} path={avatarPath} size={16} />
                            {author}
                        </Link>
                    ) : (
                        <span>Someone</span>
                    )}
                    <span>made a {l.ranked ? "ranked " : ""}list</span>
                </span>
                <span className="font-semibold">{l.title}</span>
                {preview.length > 0 && (
                    <ListPreview thumbs={preview} total={itemCount} />
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
    };

    const renderLog = (row: LogRow) => {
        const title = row.items?.title ?? "Unknown item";
        const author = row.profiles?.username;
        const avatarPath = row.profiles?.avatar_path ?? null;
        const reviewHref = author
            ? `/u/${encodeURIComponent(author)}/${row.id}`
            : null;

        return (
            <div
                key={`log-${row.id}`}
                className={`card relative grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 p-3 hover:border-accent/60 ${row.review
                    ? "@xl:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.2fr)]"
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
                    <span className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
                        {author ? (
                            <Link
                                href={`/u/${encodeURIComponent(author)}`}
                                className="relative z-10 inline-flex items-center gap-1.5 underline"
                            >
                                <Avatar name={author} path={avatarPath} size={16} />
                                {author}
                            </Link>
                        ) : (
                            <span>Someone</span>
                        )}
                        <span>logged</span>
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

                        <span className="relative z-10">
                            <LikeButton
                                viewerId={viewerId ?? null}
                                authorId={row.user_id}
                                logId={row.id}
                                initialCount={row.likes?.[0]?.count ?? 0}
                                initiallyLiked={likedSet.has(row.id)}
                            />
                        </span>

                        {reviewHref && (
                            <Link href={reviewHref} className="relative z-10 underline">
                                {commentLabel(row.comments?.[0]?.count ?? 0)}
                            </Link>
                        )}
                    </div>
                </div>

                {row.review && (
                    <p className="col-span-2 line-clamp-6 whitespace-pre-wrap break-words text-sm @xl:col-span-1 @xl:border-l @xl:border-dashed @xl:border-line @xl:pl-4">
                        {row.review}
                    </p>
                )}
            </div>
        );
    };

    const renderEntry = (entry: Entry) =>
        entry.kind === "log" ? renderLog(entry.log) : renderList(entry.list);

    return (
        <section className="flex flex-col gap-4">
            {needsSignIn && (
                <p className="text-center text-muted">
                    <Link href="/login" className="underline">
                        Sign in
                    </Link>{" "}
                    to follow people and see what they log here.
                </p>
            )}

            {noFollows && (
                <p className="text-center text-muted">
                    You&apos;re not following anyone yet. Use the search icon at the top
                    to find people and follow them to fill this feed, or switch to
                    Everyone.
                </p>
            )}

            {errorMessage && (
                <p className="text-center text-danger">{errorMessage}</p>
            )}

            {/* Only when there is genuinely nothing to show */}
            {!needsSignIn &&
                !noFollows &&
                !errorMessage &&
                entries.length === 0 && (
                    <p className="text-center text-muted">
                        {mode === "following"
                            ? "Nothing here yet. Log something, or follow people to see what they log."
                            : mode === "trending"
                            ? `Nothing has been liked in the last ${TRENDING_HOURS} hours.`
                            : "Nothing here yet."}
                    </p>
                )}

            {entries.length > 0 && (
                <>
                    {/* Narrow screens: one column, reviews and lists together */}
                    <div className="@container flex flex-col gap-4 lg:hidden">
                        {entries.map(renderEntry)}
                    </div>

                    {/* Wide screens: reviews on the left, lists on the right */}
                    <div className="hidden gap-6 lg:grid lg:grid-cols-2 lg:items-start">
                        <div className="@container flex min-w-0 flex-col gap-4">
                            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                                Reviews
                            </h2>
                            {reviewEntries.length === 0 ? (
                                <p className="text-sm text-muted">No reviews yet.</p>
                            ) : (
                                reviewEntries.map(renderEntry)
                            )}
                        </div>
                        <div className="@container flex min-w-0 flex-col gap-4">
                            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                                Lists
                            </h2>
                            {listEntries.length === 0 ? (
                                <p className="text-sm text-muted">No lists yet.</p>
                            ) : (
                                listEntries.map(renderEntry)
                            )}
                        </div>
                    </div>
                </>
            )}

            {hasMore && (
                <LoadMore href={`/?tab=${mode}&limit=${limit + PAGE_SIZE}`} />
            )}
        </section>
    );
}