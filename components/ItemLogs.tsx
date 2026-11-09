import Link from "next/link";
import { connection } from "next/server";
import ItemLogSummary from "@/components/ItemLogSummary";
import LikeButton from "@/components/LikeButton";
import LoadMore from "@/components/LoadMore";
import ShareButton from "@/components/ShareButton";
import Stars from "@/components/Stars";
import { getAdminIds } from "@/lib/admin";
import { commentLabel } from "@/lib/format";
import type { ItemLogRow } from "@/lib/itemLogs";
import { getItemRatings } from "@/lib/itemRatings";
import { PAGE_SIZE } from "@/lib/paging";
import type { ViewerState } from "@/lib/viewerState";
import AdminBadge from "./AdminBadge";
import ReviewText from "./ReviewText";

// How many of the most-liked reviews to show on top
const MOST_LIKED = 3;

type Row = ItemLogRow;

export default async function ItemLogs({
  itemId,
  limit = PAGE_SIZE,
  rows,
  error,
  viewerId,
  viewer,
}: {
  itemId: string;
  limit?: number;
  rows: Row[];
  error: string;
  viewerId: string | undefined;
  viewer: ViewerState;
}) {
  await connection();
  const adminIds = await getAdminIds();
  const { ratings, logCount } = await getItemRatings(itemId);

  if (error) {
    return <p className="text-danger">{error}</p>;
  }

  const likeCount = (r: Row) => r.likes?.[0]?.count ?? 0;

  // Reviews by people the viewer has blocked aren't shown, though their
  // ratings still count towards the average
  const visible = rows.filter((r) => !viewer.blocked.has(r.user_id));

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

  // The average counts each person's latest rating once, skipping entries
  // that have none
  const people = ratings.length;
  const average =
    people > 0 ? ratings.reduce((sum, v) => sum + v, 0) / people : 0;

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
                initiallyLiked={viewer.likedLogs.has(row.id)}
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
              initiallyShared={viewer.sharedLogs.has(row.id)}
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

      <ItemLogSummary people={people} average={average} logCount={logCount} />

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
