// ABOUTME: The logs section of an item page: rating summary, most-liked reviews, then recent ones.
// ABOUTME: Each review is a card linking to its own page, with like, share and comment actions.
import { connection } from "next/server";
import ItemLogCard from "@/components/ItemLogCard";
import ItemLogSummary from "@/components/ItemLogSummary";
import LoadMore from "@/components/LoadMore";
import { getAdminIds } from "@/lib/admin";
import type { ItemLogRow } from "@/lib/itemLogs";
import { getItemRatings } from "@/lib/itemRatings";
import { PAGE_SIZE } from "@/lib/paging";
import type { ViewerState } from "@/lib/viewerState";

// How many of the most-liked reviews to show on top
const MOST_LIKED = 3;

type Row = ItemLogRow;

export default async function ItemLogs({
  itemId,
  limit = PAGE_SIZE,
  moreHref,
  rows,
  error,
  viewerId,
  viewer,
}: {
  itemId: string;
  limit?: number;
  // Where a longer list of recent reviews comes from
  moreHref: string;
  rows: Row[];
  error: string;
  viewerId: string | undefined;
  viewer: ViewerState;
}) {
  await connection();
  const renderedAt = Date.now();
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

  const renderRow = (row: Row) => (
    <ItemLogCard
      key={row.id}
      row={row}
      isAdmin={adminIds.has(row.user_id)}
      renderedAt={renderedAt}
      viewerId={viewerId}
      viewer={viewer}
    />
  );

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

      {/* Keyed by its href, which changes when either section of the page
          loads more, so it watches again even if its own load was replaced */}
      {recentAll.length > limit && <LoadMore key={moreHref} href={moreHref} />}
    </section>
  );
}
