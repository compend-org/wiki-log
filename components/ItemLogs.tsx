// ABOUTME: The logs section of an item page: rating summary, most-liked reviews, then recent ones.
// ABOUTME: Each review is a card linking to its own page, with like, share and comment actions.

import { connection } from "next/server";
import { Fragment } from "react";
import { loadMoreItemLogs } from "@/app/itemPagesActions";
import CardPages from "@/components/CardPages";
import ItemLogSummary from "@/components/ItemLogSummary";
import { renderItemLogCards } from "@/components/loadItemPages";
import { getAdminIds } from "@/lib/admin";
import type { ItemLogRow } from "@/lib/itemLogs";
import { getItemRatings } from "@/lib/itemRatings";
import type { Keyset } from "@/lib/paging";
import type { ViewerState } from "@/lib/viewerState";

export default async function ItemLogs({
  itemId,
  popular,
  recent,
  next,
  error,
  viewerId,
  viewer,
}: {
  itemId: string;
  // The most-liked reviews, shown on top
  popular: ItemLogRow[];
  // The first page of the newest reviews, without the most-liked ones, and
  // where the next page starts
  recent: ItemLogRow[];
  next: Keyset | null;
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

  // Reviews by people the viewer has blocked aren't shown, though their
  // ratings still count towards the average
  const cards = (rows: ItemLogRow[]) =>
    renderItemLogCards(rows, viewerId, viewer, adminIds, renderedAt);
  const popularCards = cards(popular);
  const recentCards = cards(recent);

  // The average counts each person's latest rating once, skipping entries
  // that have none
  const people = ratings.length;
  const average =
    people > 0 ? ratings.reduce((sum, v) => sum + v, 0) / people : 0;

  const label = "text-sm font-semibold uppercase tracking-wide text-muted";

  return (
    <section className="flex w-full flex-col gap-3">
      <h2 className="text-xl font-bold">
        {popular.length + recent.length === 0 ? "No logs yet" : "Logs"}
      </h2>

      <ItemLogSummary people={people} average={average} logCount={logCount} />

      {popularCards.length > 0 && (
        <>
          <h3 className={label}>Most liked</h3>
          {popularCards.map((c) => (
            <Fragment key={c.key}>{c.card}</Fragment>
          ))}
        </>
      )}

      {(recentCards.length > 0 || next) && popularCards.length > 0 && (
        <h3 className={label}>Recent</h3>
      )}
      <CardPages
        first={{ cards: recentCards, next, error }}
        loadMore={loadMoreItemLogs.bind(
          null,
          itemId,
          popular.map((r) => r.id),
        )}
      />
    </section>
  );
}
