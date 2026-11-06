"use client";

// ABOUTME: Shows a feed's pages one after another and loads the next as the bottom nears.
// ABOUTME: Narrow screens get one merged column; wide screens get reviews and lists side by side.

import { Fragment, startTransition, useState } from "react";
import { loadMoreFeed } from "@/app/feedActions";
import BalancedColumns from "@/components/BalancedColumns";
import type { FeedCard, FeedMode, FeedPage } from "@/components/Feed";
import LoadMore from "@/components/LoadMore";
import { mergeColumns } from "@/lib/paging";

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
  // The snapshot and the cursor into it stay together. A refresh of the page
  // brings a new snapshot and first page, which are left alone so that what
  // is already loaded, and how far it reaches, doesn't change under the reader.
  const [paging, setPaging] = useState({
    asOf,
    next: first.next,
    ends: first.ends,
  });
  const { next, ends } = paging;
  const [pageCount, setPageCount] = useState(1);
  const [error, setError] = useState("");

  async function loadNextPage() {
    try {
      const page = await loadMoreFeed(mode, paging.asOf, next);
      // The new cards can still be arriving when they are first rendered. As a
      // transition, the page keeps showing what it has until they are ready,
      // instead of falling back to the feed's loading message.
      startTransition(() => {
        setReviews((shown) => appendNew(shown, page.reviews));
        setLists((shown) => appendNew(shown, page.lists));
        setPaging({ asOf: paging.asOf, next: page.next, ends: page.ends });
        setError(page.error);
        setPageCount((n) => n + 1);
      });
    } catch {
      setError("Couldn't load more. Reload the page to try again.");
      setPageCount((n) => n + 1);
    }
  }

  const merged = mergeColumns([
    { entries: reviews, end: ends.reviews },
    { entries: lists, end: ends.lists },
  ]);

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
