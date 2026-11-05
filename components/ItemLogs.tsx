import Link from "next/link";
import { connection } from "next/server";
import LikeButton from "@/components/LikeButton";
import LoadMore from "@/components/LoadMore";
import ShareButton from "@/components/ShareButton";
import Stars from "@/components/Stars";
import { getAdminIds } from "@/lib/admin";
import { getBlockedIds } from "@/lib/blocks";
import { commentLabel } from "@/lib/format";
import { getLikedSet } from "@/lib/likes";
import { PAGE_SIZE } from "@/lib/paging";
import { getSharedSet } from "@/lib/shares";
import { createClient } from "@/lib/supabase/server";
import AdminBadge from "./AdminBadge";
import ReviewText from "./ReviewText";

// How many of the most-liked reviews to show on top
const MOST_LIKED = 3;

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
  shares: { count: number }[];
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
  const adminIds = await getAdminIds();

  const { data, error } = await supabase
    .from("logs")
    .select(
      "id, user_id, item_id, rating, review, logged_at, profiles!logs_user_id_profiles_fkey(username), likes(count), comments(count), shares(count)",
    )
    .eq("item_id", itemId)
    .order("logged_at", { ascending: false });

  if (error) {
    return <p className="text-danger">{error.message}</p>;
  }

  const rows = (data ?? []) as unknown as Row[];
  const likeCount = (r: Row) => r.likes?.[0]?.count ?? 0;

  // Reviews by people the viewer has blocked aren't shown, though their
  // ratings still count towards the average
  const blocked = await getBlockedIds(supabase, viewerId);
  const visible = rows.filter((r) => !blocked.has(r.user_id));

  // The most-liked reviews: written ones with at least one like, most likes
  // first, newer first when tied
  const popular = visible
    .filter((r) => likeCount(r) > 0)
    .sort(
      (a, b) =>
        likeCount(b) - likeCount(a) ||
        new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime(),
    )
    .slice(0, MOST_LIKED);

  // Everything else, newest first. Reviews shown above don't repeat here.
  const popularIds = new Set(popular.map((r) => r.id));
  const recentAll = visible.filter((r) => !popularIds.has(r.id));
  const recent = recentAll.slice(0, limit);

  const likedSet = await getLikedSet(supabase, viewerId, [
    ...popular,
    ...recent,
  ]);

  const sharedSet = await getSharedSet(
    supabase,
    viewerId,
    "log",
    [...popular, ...recent].map((r) => r.id),
  );

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

  const renderRow = (row: Row) => {
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
          {adminIds.has(row.user_id) && <AdminBadge />}
          <Stars rating={row.rating} />
          <span className="ml-auto text-xs text-muted">
            {new Date(row.logged_at).toLocaleDateString()}
          </span>
        </div>
        {row.review && (
          <p className="text-sm">
            <ReviewText text={row.review} />
          </p>
        )}
        <div className="flex items-center gap-3 text-xs text-muted">
          {row.review && (
            <span className="relative z-10">
              <LikeButton
                viewerId={viewerId ?? null}
                authorId={row.user_id}
                logId={row.id}
                initialCount={likeCount(row)}
                initiallyLiked={likedSet.has(row.id)}
              />
            </span>
          )}
          <span className="relative z-10">
            <ShareButton
              viewerId={viewerId ?? null}
              ownerId={row.user_id}
              kind="log"
              targetId={row.id}
              initialCount={row.shares?.[0]?.count ?? 0}
              initiallyShared={sharedSet.has(row.id)}
            />
          </span>
          {reviewHref && (
            <Link href={reviewHref} className="relative z-10 underline">
              {commentLabel(row.comments?.[0]?.count ?? 0)}
            </Link>
          )}
        </div>
      </div>
    );
  };

  const label = "text-sm font-semibold uppercase tracking-wide text-muted";

  return (
    <section className="flex w-full flex-col gap-3">
      <h2 className="text-xl font-bold">
        {rows.length === 0 ? "No logs yet" : "Logs"}
      </h2>

      {people < 10 && (
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

      {popular.length > 0 && (
        <>
          <h3 className={label}>Most liked</h3>
          {popular.map(renderRow)}
        </>
      )}

      {recent.length > 0 && (
        <>
          {popular.length > 0 && <h3 className={label}>Recent</h3>}
          {recent.map(renderRow)}
        </>
      )}

      {recentAll.length > limit && (
        <LoadMore
          key={limit}
          href={`/item/${itemId}?limit=${limit + PAGE_SIZE}`}
        />
      )}
    </section>
  );
}
