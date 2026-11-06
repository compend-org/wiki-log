// ABOUTME: The Digest page's list of long reviews, a page at a time.
// ABOUTME: Renders each page's cards on the server; DigestPages adds later pages below.
import { connection } from "next/server";
import type { ReactNode } from "react";
import DigestCard from "@/components/DigestCard";
import DigestPages from "@/components/DigestPages";
import { getDigest } from "@/lib/digest";
import { createClient } from "@/lib/supabase/server";
import { getViewerState } from "@/lib/viewerState";

export type DigestCardItem = { key: string; card: ReactNode };

export type DigestPage = {
  cards: DigestCardItem[];
  // Where the next page starts, or null when this was the last one
  next: string | null;
  error: string;
};

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

export default async function Digest() {
  await connection();
  const page = await loadDigestPage(null);

  if (page.error) {
    return <p className="text-center text-danger">{page.error}</p>;
  }
  if (page.cards.length === 0 && !page.next) {
    return <p className="py-12 text-center text-muted">No long reviews yet.</p>;
  }

  return <DigestPages first={page} />;
}
