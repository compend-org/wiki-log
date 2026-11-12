// ABOUTME: Loads one page of the Digest and renders its cards for the viewer.
// ABOUTME: Kept apart from Digest so the server action can use it without importing DigestPages.
import type { CardsPage } from "@/components/CardPages";
import DigestCard from "@/components/DigestCard";
import { getDigest } from "@/lib/digest";
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

  // Reviews by people the viewer has blocked are left out
  const shown = logs.filter((l) => !viewer.blocked.has(l.user_id));

  return {
    cards: shown.map((row) => ({
      key: row.id,
      card: (
        <DigestCard
          row={row}
          viewerId={viewerId}
          liked={viewer.likedLogs.has(row.id)}
          shared={viewer.sharedLogs.has(row.id)}
          now={now}
        />
      ),
    })),
    next,
    error,
  };
}
