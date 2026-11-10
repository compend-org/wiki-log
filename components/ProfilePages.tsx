"use client";

// ABOUTME: Shows a person's lists or reviews on their profile and loads more on request.
// ABOUTME: Lists load more with a button; reviews, at the bottom of the page, as it scrolls.

import { Fragment, startTransition, useState } from "react";
import { loadMoreProfile } from "@/app/profileActions";
import LoadMore from "@/components/LoadMore";
import type {
  ProfileCard,
  ProfileCardsPage,
  ProfileKind,
} from "@/components/loadProfilePage";

// A list or review can come again if things were added while paging; it stays
// where it was first shown
function appendNew(shown: ProfileCard[], more: ProfileCard[]): ProfileCard[] {
  const have = new Set(shown.map((c) => c.key));
  return [...shown, ...more.filter((c) => !have.has(c.key))];
}

export default function ProfilePages({
  profileId,
  kind,
  first,
}: {
  profileId: string;
  kind: ProfileKind;
  first: ProfileCardsPage;
}) {
  const [cards, setCards] = useState<ProfileCard[]>(first.cards);
  const [next, setNext] = useState(first.next);
  const [error, setError] = useState(first.error);
  const [loading, setLoading] = useState(false);
  const [pageCount, setPageCount] = useState(1);

  async function loadNextPage() {
    if (!next) return;
    setLoading(true);
    try {
      const page = await loadMoreProfile(profileId, kind, next);
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
    <>
      {cards.map((c) => (
        <Fragment key={c.key}>{c.card}</Fragment>
      ))}
      {error && <p className="text-center text-danger">{error}</p>}
      {next &&
        !error &&
        (kind === "reviews" ? (
          <LoadMore key={pageCount} onLoad={loadNextPage} />
        ) : (
          <button
            type="button"
            onClick={loadNextPage}
            disabled={loading}
            className="self-start text-sm underline disabled:opacity-60"
          >
            {loading ? "Loading…" : "Show more lists"}
          </button>
        ))}
    </>
  );
}
