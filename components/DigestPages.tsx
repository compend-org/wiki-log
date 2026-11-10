"use client";

// ABOUTME: Shows the digest's pages one after another and loads the next as the bottom nears.
// ABOUTME: The first page comes from the server; later pages are asked for with a server action.

import { Fragment, startTransition, useState } from "react";
import { loadMoreDigest } from "@/app/digestActions";
import LoadMore from "@/components/LoadMore";
import type { DigestCardItem, DigestPage } from "@/components/loadDigestPage";
import { track } from "@/lib/analytics";

// A later page can repeat a review that is already shown, if one was posted
// while the reader was scrolling. It stays where it is.
function appendNew(
  shown: DigestCardItem[],
  more: DigestCardItem[],
): DigestCardItem[] {
  const have = new Set(shown.map((c) => c.key));
  return [...shown, ...more.filter((c) => !have.has(c.key))];
}

export default function DigestPages({ first }: { first: DigestPage }) {
  const [cards, setCards] = useState(first.cards);
  const [next, setNext] = useState(first.next);
  const [pageCount, setPageCount] = useState(1);
  const [error, setError] = useState("");

  async function loadNextPage() {
    try {
      const page = await loadMoreDigest(next);
      track("feed_more_loaded", { feed: "digest", page: pageCount + 1 });
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
      setPageCount((n) => n + 1);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {cards.map((c) => (
        <Fragment key={c.key}>{c.card}</Fragment>
      ))}

      {error && <p className="text-center text-danger">{error}</p>}

      {next && !error && <LoadMore key={pageCount} onLoad={loadNextPage} />}
    </div>
  );
}
