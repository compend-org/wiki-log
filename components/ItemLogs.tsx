import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLikedSet, likeKey } from "@/lib/likes";
import { commentLabel } from "@/lib/format";
import { PAGE_SIZE } from "@/lib/paging";
import LikeButton from "@/components/LikeButton";
import LoadMore from "@/components/LoadMore";
import Stars from "@/components/Stars";

type Row = {
  user_id: string;
  item_id: string;
  rating: number;
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
      "user_id, item_id, rating, review, logged_at, profiles!logs_user_id_profiles_fkey(username), likes(count), comments(count)"
    )
    .eq("item_id", itemId)
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
    <section className="flex w-full flex-col gap-3">
      <h2 className="text-xl font-bold">
        {count === 0 ? "No logs yet" : "Logs"}
      </h2>

      {count > 0 && (
        <p className="text-muted">
          <span className="text-accent">★</span> {average.toFixed(1)} average ·{" "}
          {count} {count === 1 ? "log" : "logs"}
        </p>
      )}

      {rows.slice(0, limit).map((row) => {
        const author = row.profiles?.username;
        const reviewHref = author
          ? `/u/${encodeURIComponent(author)}/${row.item_id}`
          : null;

        return (
          <div
            key={row.user_id}
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
        );
      })}

      {rows.length > limit && (
        <LoadMore href={`/item/${itemId}?limit=${limit + PAGE_SIZE}`} />
      )}
    </section>
  );
}