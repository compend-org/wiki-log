import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLikedSet } from "@/lib/likes";
import { commentLabel } from "@/lib/format";
import { PAGE_SIZE } from "@/lib/paging";
import LikeButton from "@/components/LikeButton";
import LoadMore from "@/components/LoadMore";
import Stars from "@/components/Stars";

type Row = {
    id: string;
    user_id: string;
    item_id: string;
    rating: number | null;
    review: string;
    logged_at: string;
    profiles: { username: string } | null;
    likes: { count: number }[];
    comments: { count: number }[];
};

export default async function ItemLogs({
    itemId,
    limit = PAGE_SIZE,
}: {
    itemId: string;
    limit?: number;
}) {
    await connection();
    const supabase = await createClient();

    const { data: claimsData } = await supabase.auth.getClaims();
    const viewerId: string | undefined = claimsData?.claims?.sub;

    const { data, error } = await supabase
        .from("logs")
        .select(
            "id, user_id, item_id, rating, review, logged_at, profiles!logs_user_id_profiles_fkey(username), likes(count), comments(count)"
        )
        .eq("item_id", itemId)
        .order("logged_at", { ascending: false });

    if (error) {
        return <p className="text-danger">{error.message}</p>;
    }

    const rows = (data ?? []) as unknown as Row[];
    const shown = rows.slice(0, limit);
    const likedSet = await getLikedSet(supabase, viewerId, shown);

    // The average counts each person's latest rating once
    // The average counts each person's latest rating once, skipping entries
    // that have none
    const latest = new Map<string, number>();
    for (const r of rows) {
        if (r.rating !== null && !latest.has(r.user_id)) {
            latest.set(r.user_id, Number(r.rating));
        }
    }
    const people = latest.size;
    const average =
        people > 0
            ? [...latest.values()].reduce((sum, v) => sum + v, 0) / people
            : 0;

    return (
        <section className="flex w-full flex-col gap-3">
            <h2 className="text-xl font-bold">
                {rows.length === 0 ? "No logs yet" : "Logs"}
            </h2>

            {rows.length > 0 && (
                <p className="text-muted">
                    {people > 0 && (
                        <>
                            <span className="text-star">★</span> {average.toFixed(1)} average
                            from {people} {people === 1 ? "person" : "people"} ·{" "}
                        </>
                    )}
                    {rows.length} {rows.length === 1 ? "entry" : "entries"}
                </p>
            )}

            {shown.map((row) => {
                const author = row.profiles?.username;
                const reviewHref = author
                    ? `/u/${encodeURIComponent(author)}/${row.id}`
                    : null;

                return (
                    <div
                        key={row.id}
                        className="card relative flex flex-col gap-1 p-3 hover:border-accent/60"
                    >
                        {reviewHref && (
                            <Link
                                href={reviewHref}
                                aria-label={`Open ${author}'s review`}
                                className="absolute inset-0 rounded-[inherit]"
                            />
                        )}
                        <div className="flex items-center gap-2 text-sm">
                            {author ? (
                                <Link
                                    href={`/u/${encodeURIComponent(author)}`}
                                    className="relative z-10 underline"
                                >
                                    {author}
                                </Link>
                            ) : (
                                <span>Someone</span>
                            )}
                            <Stars rating={row.rating} />
                            <span className="ml-auto text-xs text-muted">
                                {new Date(row.logged_at).toLocaleDateString()}
                            </span>
                        </div>
                        {row.review && <p className="text-sm">{row.review}</p>}
                        <div className="flex items-center gap-3 text-xs text-muted">
                            {row.review && (
                                <span className="relative z-10">
                                    <LikeButton
                                        viewerId={viewerId ?? null}
                                        authorId={row.user_id}
                                        logId={row.id}
                                        initialCount={row.likes?.[0]?.count ?? 0}
                                        initiallyLiked={likedSet.has(row.id)}
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
                );
            })}

            {rows.length > limit && (
                <LoadMore href={`/item/${itemId}?limit=${limit + PAGE_SIZE}`} />
            )}
        </section>
    );
}