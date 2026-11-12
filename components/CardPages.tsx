"use client";

// ABOUTME: Shows a list of cards and loads the next page as the bottom nears.
// ABOUTME: The first page comes from the server; later pages from a server action it is given.

import { Fragment, type ReactNode, startTransition, useState } from "react";
import LoadMore from "@/components/LoadMore";
import type { Keyset } from "@/lib/paging";

export type Card = { key: string; card: ReactNode };

export type CardsPage = {
  cards: Card[];
  // Where the next page starts, or null when there's nothing more
  next: Keyset | null;
  error: string;
};

// A card can come again if things were added while paging; it stays where it
// was first shown
function appendNew(shown: Card[], more: Card[]): Card[] {
  const have = new Set(shown.map((c) => c.key));
  return [...shown, ...more.filter((c) => !have.has(c.key))];
}

export default function CardPages({
  first,
  loadMore,
}: {
  first: CardsPage;
  loadMore: (after: Keyset) => Promise<CardsPage>;
}) {
  const [cards, setCards] = useState(first.cards);
  const [next, setNext] = useState(first.next);
  const [error, setError] = useState(first.error);
  const [pageCount, setPageCount] = useState(1);

  async function loadNextPage() {
    if (!next) return;
    try {
      const page = await loadMore(next);
      // As a transition, the page keeps showing what it has until the new
      // cards are ready
      startTransition(() => {
        setCards((shown) => appendNew(shown, page.cards));
        setNext(page.next);
        setError(page.error);
        setPageCount((n) => n + 1);
      });
    } catch {
      setError("Couldn't load more. Reload the page to try again.");
    }
  }

  return (
    <>
      {cards.map((c) => (
        <Fragment key={c.key}>{c.card}</Fragment>
      ))}
      {error && <p className="text-center text-danger">{error}</p>}
      {next && !error && <LoadMore key={pageCount} onLoad={loadNextPage} />}
    </>
  );
}
