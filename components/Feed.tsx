import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { USE_STUB } from "@/lib/video";
import { getLikedSet, likeKey } from "@/lib/likes";
import LikeButton from "@/components/LikeButton";
import { commentLabel } from "@/lib/format";
import { PAGE_SIZE } from "@/lib/paging";
import LoadMore from "@/components/LoadMore";
import Stars from "./Stars";

type Tab = "following" | "everyone";

type FeedRow = {
    user_id: string;
    video_id: string;
    rating: number;
    review: string;
    logged_at: string;
    videos: { title: string } | null;
    profiles: { username: string } | null;
    likes: { count: number }[];
    comments: { count: number }[];
};

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

    // Who do I follow?
    let followingIds: string[] = [];
    if (active === "following" && viewerId) {
        const { data: followRows } = await supabase
            .from("follows")
            .select("following_id")
            .eq("follower_id", viewerId);
        followingIds = (followRows ?? []).map((r) => r.following_id);
    }

    // Only load logs when there's something to show
    let rows: FeedRow[] = [];
    let hasMore = false;
    let errorMessage = "";
    if (active === "everyone" || followingIds.length > 0) {
        let query = supabase
            .from("logs")
            .select(
                "user_id, video_id, rating, review, logged_at, videos(title), profiles!logs_user_id_profiles_fkey(username), likes(count), comments(count)"
            )
            .order("logged_at", { ascending: false })
            .limit(limit + 1);
        if (active === "following") {
            query = query.in("user_id", followingIds);
        }
        const { data, error } = await query;
        if (error) errorMessage = error.message;
        rows = (data ?? []) as unknown as FeedRow[];
        hasMore = rows.length > limit;
        rows = rows.slice(0, limit);
    }

    const likedSet = await getLikedSet(supabase, viewerId, rows);

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
                        className={`-mb-px flex-1 border-b-2 px-4 py-3 text-center text-sm font-semibold ${active === t
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
                rows.length === 0 && (
                    <p className="text-muted">
                        {active === "following"
                            ? "Nothing from the people you follow yet."
                            : "Nothing here yet."}
                    </p>
                )}

            {rows.map((row) => (
                <div
                    key={`${row.user_id}-${row.video_id}`}
                    className="flex gap-4 rounded-lg border border-line p-3"
                >
                    <Link href={`/video/${row.video_id}`} className="shrink-0">
                        {USE_STUB ? (
                            <div className="aspect-video w-32 rounded bg-surface" />
                        ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={`https://i.ytimg.com/vi/${row.video_id}/mqdefault.jpg`}
                                alt={row.videos?.title ?? "Video"}
                                className="aspect-video w-32 rounded object-cover"
                            />
                        )}
                    </Link>
                    <div className="flex min-w-0 flex-col gap-1">
                        <span className="text-sm text-muted">
                            {row.profiles ? (
                                <Link
                                    href={`/u/${encodeURIComponent(row.profiles.username)}`}
                                    className="underline"
                                >
                                    {row.profiles.username}
                                </Link>
                            ) : (
                                "Someone"
                            )}{" "}
                            logged
                        </span>
                        <Link href={`/video/${row.video_id}`} className="font-semibold">
                            {row.videos?.title ?? "Unknown video"}
                        </Link>
                        <Stars rating={row.rating} />
                        {row.review && <p className="text-sm">{row.review}</p>}
                        <div className="flex items-center gap-3 text-xs text-muted">
                            <span>{new Date(row.logged_at).toLocaleDateString()}</span>
                            {row.review && (
                                <LikeButton
                                    viewerId={viewerId ?? null}
                                    authorId={row.user_id}
                                    videoId={row.video_id}
                                    initialCount={row.likes?.[0]?.count ?? 0}
                                    initiallyLiked={likedSet.has(
                                        likeKey(row.user_id, row.video_id)
                                    )}
                                />
                            )
                            }
                            {row.profiles && (
                                <Link
                                    href={`/u/${encodeURIComponent(row.profiles.username)}/${row.video_id}`}
                                    className="underline"
                                >
                                    {commentLabel(row.comments?.[0]?.count ?? 0)}
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            ))}
            {hasMore && <LoadMore href={`/?tab=${active}&limit=${limit + PAGE_SIZE}`} />}
        </section>
    );
}