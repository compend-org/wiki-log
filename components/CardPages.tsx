"use client";

// ABOUTME: Shows a list of cards and loads the next page as the bottom nears, or with a button.
// ABOUTME: The first page comes from the server; later pages from a server action it is given.

import {
  createContext,
  Fragment,
  type ReactNode,
  startTransition,
  useCallback,
  useContext,
  useState,
} from "react";
import LoadMore from "@/components/LoadMore";
import type { Keyset } from "@/lib/paging";

export type Card = { key: string; card: ReactNode };

export type CardsPage<Cursor = Keyset> = {
  cards: Card[];
  // Where the next page starts, or null when there's nothing more
  next: Cursor | null;
  error: string;
};

// Lets a card take itself off the list, such as once it has been deleted.
// The cards are rendered on the server, so they can't be handed a callback.
const RemoveCardContext = createContext<((key: string) => void) | null>(null);

// Takes the card with this key off the CardPages it is in. Null outside one.
export function useRemoveCard(): ((key: string) => void) | null {
  return useContext(RemoveCardContext);
}

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
  const [cards, setCards] = useState(first.cards);
  const [next, setNext] = useState(first.next);
  const [error, setError] = useState(first.error);
  const [loading, setLoading] = useState(false);
  const [pageCount, setPageCount] = useState(1);
  // The list keeps what it has shown rather than following `first`, so it
  // doesn't lose the pages it loaded when the server page refreshes
  const removeCard = useCallback((key: string) => {
    setCards((shown) => shown.filter((c) => c.key !== key));
  }, []);

  async function loadNextPage() {
    if (!next) return;
    setLoading(true);
    try {
      const page = await loadMore(next);
      onPageLoaded?.(pageCount + 1);
      // As a transition, the page keeps showing what it has until the new
      // cards are ready
      startTransition(() => {
        setCards((shown) => appendNew(shown, page.cards));
        setNext(page.next);
        setError(page.error);
        setPageCount((n) => n + 1);
        setLoading(false);
      });
    } catch {
      setError("Couldn't load more. Reload the page to try again.");
      setLoading(false);
    }
  }

  return (
    <RemoveCardContext value={removeCard}>
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
    </RemoveCardContext>
  );
}
