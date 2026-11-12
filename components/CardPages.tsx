"use client";

// ABOUTME: Shows a list of cards and loads the next page as the bottom nears, or with a button.
// ABOUTME: The first page comes from the server; later pages from a server action it is given.

import { Fragment, type ReactNode, startTransition, useState } from "react";
import LoadMore from "@/components/LoadMore";
import type { Keyset } from "@/lib/paging";

export type Card = { key: string; card: ReactNode };

export type CardsPage<Cursor = Keyset> = {
  cards: Card[];
  // Where the next page starts, or null when there's nothing more
  next: Cursor | null;
  error: string;
};

// The pages loaded after the first one, and the first page they continue
type LaterPages<Cursor> = {
  firstKeys: string;
  cards: Card[];
  next: Cursor | null;
  error: string;
  pageCount: number;
};

// A card can come again if things were added while paging; it stays where it
// was first shown
function appendNew(shown: Card[], more: Card[]): Card[] {
  const have = new Set(shown.map((c) => c.key));
  return [...shown, ...more.filter((c) => !have.has(c.key))];
}

export default function CardPages<Cursor>({
  first,
  loadMore,
  moreButton,
  onPageLoaded,
}: {
  first: CardsPage<Cursor>;
  loadMore: (after: Cursor) => Promise<CardsPage<Cursor>>;
  // The label of a button that loads the next page. Without one, pages load
  // as the bottom scrolls into view.
  moreButton?: string;
  // Called with each later page's number once it has loaded
  onPageLoaded?: (page: number) => void;
}) {
  // The first page always shows what the server sent last. The pages loaded
  // after it are kept only while that first page has the same cards, since
  // they continue from where it ended.
  const firstKeys = first.cards.map((c) => c.key).join();
  const [loaded, setLoaded] = useState<LaterPages<Cursor> | null>(null);
  const later = loaded?.firstKeys === firstKeys ? loaded : null;
  const cards = later ? appendNew(first.cards, later.cards) : first.cards;
  const next = later ? later.next : first.next;
  const pageCount = later ? later.pageCount : 1;
  const error = later ? later.error : first.error;
  const [loading, setLoading] = useState(false);

  async function loadNextPage() {
    if (!next) return;
    setLoading(true);
    try {
      const page = await loadMore(next);
      onPageLoaded?.(pageCount + 1);
      // As a transition, the page keeps showing what it has until the new
      // cards are ready
      startTransition(() => {
        setLoaded({
          firstKeys,
          cards: appendNew(later?.cards ?? [], page.cards),
          next: page.next,
          error: page.error,
          pageCount: pageCount + 1,
        });
        setLoading(false);
      });
    } catch {
      setLoaded({
        firstKeys,
        cards: later?.cards ?? [],
        next,
        error: "Couldn't load more. Reload the page to try again.",
        pageCount,
      });
      setLoading(false);
    }
  }

  return (
    <>
      {cards.map((c) => (
        <Fragment key={c.key}>{c.card}</Fragment>
      ))}
      {error && <p className="text-center text-danger">{error}</p>}
      {next &&
        !error &&
        (moreButton ? (
          <button
            type="button"
            onClick={loadNextPage}
            disabled={loading}
            className="self-start text-sm underline disabled:opacity-60"
          >
            {loading ? "Loading…" : moreButton}
          </button>
        ) : (
          <LoadMore key={pageCount} onLoad={loadNextPage} />
        ))}
    </>
  );
}
