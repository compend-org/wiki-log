// ABOUTME: Loads one page of the Digest and renders its cards for the viewer.
// ABOUTME: Kept apart from Digest so the server action can use it without importing DigestPages.

import DigestCard from "@/components/feed/DigestCard";
import HideableCard from "@/components/items/HideableCard";
import type { CardsPage } from "@/components/paging/CardPages";
import { type DigestLog, getDigest } from "@/lib/feed/digest";
import { withoutHiddenItems } from "@/lib/hiddenItems";
import { aboutAdultItem, shownEntries } from "@/lib/sfw";
import { createClient } from "@/lib/supabase/server";
import { getViewerState } from "@/lib/viewerState";

// A page of the digest; the next one starts before the time in `next`
export type DigestPage = CardsPage<string>;

// One page of the digest, rendered for the viewer: the reviews are the same
// for everyone (and cached), but the hearts and shares are the viewer's own.
export async function loadDigestPage(
  before: string | null,
): Promise<DigestPage> {
  const now = Date.now();
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const viewerId: string | undefined = claimsData?.claims?.sub;

  const { logs, next, error } = await getDigest(before);

  const viewer = await getViewerState(supabase, viewerId, {
    logIds: logs.map((l) => l.id),
  });

  // Reviews by people the viewer has blocked are left out, and reviews of
  // items they have hidden, and of adult items when the viewer hides them
  const shown = shownEntries(
    withoutHiddenItems(
      logs.filter((l) => !viewer.blocked.has(l.user_id)),
      viewer.hiddenItems,
      (l) => l.item_id,
    ),
    viewer.sfwMode,
    aboutAdultItem,
  );

  const digestCard = (row: DigestLog) => (
    <DigestCard
      row={row}
      viewerId={viewerId}
      liked={viewer.likedLogs.has(row.id)}
      shared={viewer.sharedLogs.has(row.id)}
      now={now}
    />
  );

  return {
    // The tab stays loaded while others are open, so a review goes away here
    // as soon as its item is hidden anywhere
    cards: shown.map((row) => ({
      key: row.id,
      card: viewerId ? (
        <HideableCard
          viewerId={viewerId}
          itemId={row.item_id}
          title={row.items?.title ?? ""}
          cardKey={`digest-${row.id}`}
        >
          {digestCard(row)}
        </HideableCard>
      ) : (
        digestCard(row)
      ),
    })),
    next,
    error,
  };
}
