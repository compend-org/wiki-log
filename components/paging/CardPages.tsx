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
  useSyncExternalStore,
} from "react";
import LoadMore from "@/components/paging/LoadMore";
import type { Keyset } from "@/lib/paging";

export type Card = { key: string; card: ReactNode };

// Screens narrower than Tailwind's `sm` breakpoint
const NARROW_SCREEN = "(max-width: 639px)";

function subscribeToScreenWidth(onChange: () => void) {
  const query = window.matchMedia(NARROW_SCREEN);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

// Whether the screen is narrow, like a phone's. Wide until the page is in the
// browser, since the server can't know.
function useNarrowScreen(): boolean {
  return useSyncExternalStore(
    subscribeToScreenWidth,
    () => window.matchMedia(NARROW_SCREEN).matches,
    () => false,
  );
}

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
  moreButtonOnMobile,
  onPageLoaded,
}: {
  first: CardsPage<Cursor>;
  loadMore: (after: Cursor) => Promise<CardsPage<Cursor>>;
  // The label of a button that loads the next page. Without one, pages load
  // as the bottom scrolls into view.
  moreButton?: string;
  // Like `moreButton`, but only on a narrow screen. Wider ones load pages as
  // the bottom scrolls into view.
  moreButtonOnMobile?: string;
  // Called with each later page's number once it has loaded
  onPageLoaded?: (page: number) => void;
}) {
  // The first page always shows what the server sent last. The pages loaded
  // after it are kept only while that first page has the same cards, since
  // they continue from where it ended.
  const firstKeys = first.cards.map((c) => c.key).join();
  const [loaded, setLoaded] = useState<LaterPages<Cursor> | null>(null);
  const later = loaded?.firstKeys === firstKeys ? loaded : null;
  // Cards taken off the list, such as deleted ones, stay off it whichever
  // page they came from, also before the refreshed page arrives
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const cards = (
    later ? appendNew(first.cards, later.cards) : first.cards
  ).filter((c) => !removed.has(c.key));
  const next = later ? later.next : first.next;
  const pageCount = later ? later.pageCount : 1;
  const error = later ? later.error : first.error;
  const [loading, setLoading] = useState(false);
  const narrow = useNarrowScreen();
  const buttonLabel = moreButton ?? (narrow ? moreButtonOnMobile : undefined);
  const removeCard = useCallback((key: string) => {
    setRemoved((keys) => new Set(keys).add(key));
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
    <RemoveCardContext value={removeCard}>
      {cards.map((c) => (
        <Fragment key={c.key}>{c.card}</Fragment>
      ))}
      {error && <p className="text-center text-danger">{error}</p>}
      {next &&
        !error &&
        (buttonLabel ? (
          <button
            type="button"
            onClick={loadNextPage}
            disabled={loading}
            className="self-center border border-line bg-surface px-4 py-2 text-sm text-foreground hover:border-accent hover:no-underline disabled:opacity-40"
          >
            {loading ? "Loading…" : buttonLabel}
          </button>
        ) : (
          <LoadMore key={pageCount} onLoad={loadNextPage} />
        ))}
    </RemoveCardContext>
  );
}
