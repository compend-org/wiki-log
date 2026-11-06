"use client";

// ABOUTME: Shows a feed's pages one after another and loads the next as the bottom nears.
// ABOUTME: Narrow screens get one merged column; wide screens get reviews and lists side by side.

import { Fragment, useState } from "react";
import { loadMoreFeed } from "@/app/feedActions";
import BalancedColumns from "@/components/BalancedColumns";
import type { FeedCard, FeedMode, FeedPage } from "@/components/Feed";
import LoadMore from "@/components/LoadMore";

// Most likes first (Trending), then newest first
function feedOrder(a: FeedCard, b: FeedCard): number {
  return b.score - a.score || Date.parse(b.date) - Date.parse(a.date);
}

// A later page can bring a post that is already shown, if it was also posted
// or shared earlier than when it was first shown. It stays where it is.
function appendNew(shown: FeedCard[], more: FeedCard[]): FeedCard[] {
  const have = new Set(shown.map((c) => c.key));
  return [...shown, ...more.filter((c) => !have.has(c.key))];
}

function renderCards(cards: FeedCard[]) {
  return cards.map((c) => <Fragment key={c.key}>{c.card}</Fragment>);
}

export default function FeedPages({
  mode,
  asOf,
  first,
}: {
  mode: FeedMode;
  // When this feed was first loaded. Later pages leave out anything newer.
  asOf: string;
  first: FeedPage;
}) {
  const [reviews, setReviews] = useState<FeedCard[]>(first.reviews);
  const [lists, setLists] = useState<FeedCard[]>(first.lists);
  const [next, setNext] = useState(first.next);
  const [pageCount, setPageCount] = useState(1);
  const [error, setError] = useState("");

  async function loadNextPage() {
    try {
      const page = await loadMoreFeed(mode, asOf, next);
      setReviews((shown) => appendNew(shown, page.reviews));
      setLists((shown) => appendNew(shown, page.lists));
      setNext(page.next);
      setError(page.error);
    } catch {
      setError("Couldn't load more. Reload the page to try again.");
    }
    setPageCount((n) => n + 1);
  }

  // The merged column shows everything loaded that comes before the last card
  // of each column that still has more, so nothing can turn up above it later
  const ends = [
    next.reviews && reviews.at(-1),
    next.lists && lists.at(-1),
  ].filter((c): c is FeedCard => Boolean(c));
  const merged = [...reviews, ...lists]
    .sort(feedOrder)
    .filter((c) => ends.every((end) => feedOrder(c, end) <= 0));

  const hasMore = Boolean(next.reviews || next.lists);

  return (
    <>
      {/* Narrow screens: one column, reviews and lists together */}
      <div className="@container flex flex-col gap-4 lg:hidden">
        {renderCards(merged)}
      </div>

      {/* Wide screens: reviews on the left, lists on the right */}
      <BalancedColumns
        leftHasMore={Boolean(next.reviews)}
        rightHasMore={Boolean(next.lists)}
        left={
          <>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Reviews
            </h2>
            {reviews.length === 0 ? (
              <p className="text-sm text-muted">No reviews yet.</p>
            ) : (
              renderCards(reviews)
            )}
          </>
        }
        right={
          <>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Lists
            </h2>
            {lists.length === 0 ? (
              <p className="text-sm text-muted">No lists yet.</p>
            ) : (
              renderCards(lists)
            )}
          </>
        }
      />

      {error && <p className="text-center text-danger">{error}</p>}

      {hasMore && !error && <LoadMore key={pageCount} onLoad={loadNextPage} />}
    </>
  );
}
