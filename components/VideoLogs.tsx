import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLikedSet, likeKey } from "@/lib/likes";
import LikeButton from "@/components/LikeButton";
import { commentLabel } from "@/lib/format";
import Stars from "./Stars";
import { PAGE_SIZE } from "@/lib/paging";
import LoadMore from "@/components/LoadMore";

type Row = {
    user_id: string;
    video_id: string;
    rating: number;
    review: string;
    logged_at: string;
    profiles: { username: string } | null;
    likes: { count: number }[];
    comments: { count: number }[];
};

export default async function VideoLogs({ videoId, limit = PAGE_SIZE }: { videoId: string; limit?: number }) {
    await connection();
    const supabase = await createClient();

    const { data: claimsData } = await supabase.auth.getClaims();
    const viewerId: string | undefined = claimsData?.claims?.sub;

    const { data, error } = await supabase
        .from("logs")
        .select(
            "user_id, video_id, rating, review, logged_at, videos(title), profiles!logs_user_id_profiles_fkey(username), likes(count), comments(count)")
        .eq("video_id", videoId)
        .order("logged_at", { ascending: false });

    if (error) {
        return <p className="text-danger">{error.message}</p>;
    }

    const rows = (data ?? []) as unknown as Row[];
    const likedSet = await getLikedSet(supabase, viewerId, rows);

    const count = rows.length;
    const average =
        count > 0 ? rows.reduce((sum, r) => sum + r.rating, 0) / count : 0;

    return (
        <section className="flex w-full max-w-xl flex-col gap-3">
            <h2 className="text-xl font-bold">
                {count === 0 ? "No logs yet" : "Logs"}
            </h2>

            {count > 0 && (
                <p className="text-muted">
                    <span className="text-accent">★</span> {average.toFixed(1)} average ·{" "}
                    {count} {count === 1 ? "log" : "logs"}
                </p>
            )}

            {rows.slice(0, limit).map((row) => (
                <div
                    key={row.user_id}
                    className="flex flex-col gap-1 rounded-lg border border-line p-3"
                >
                    <div className="flex items-center gap-2 text-sm">
                        {row.profiles ? (
                            <Link
                                href={`/u/${encodeURIComponent(row.profiles.username)}`}
                                className="underline"
                            >
                                {row.profiles.username}
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
                            <LikeButton
                                viewerId={viewerId ?? null}
                                authorId={row.user_id}
                                videoId={row.video_id}
                                initialCount={row.likes?.[0]?.count ?? 0}
                                initiallyLiked={likedSet.has(likeKey(row.user_id, row.video_id))}
                            />
                        )}
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
            ))}
            {rows.length > limit && (
                <LoadMore href={`/video/${videoId}?limit=${limit + PAGE_SIZE}`} />
            )}
        </section>
    );
}