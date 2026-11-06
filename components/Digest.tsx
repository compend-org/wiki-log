// ABOUTME: The Digest page's list of long reviews, a page at a time.
// ABOUTME: Renders each page's cards on the server; DigestPages adds later pages below.
import { connection } from "next/server";
import type { ReactNode } from "react";
import DigestCard from "@/components/DigestCard";
import DigestPages from "@/components/DigestPages";
import { getBlockedIds } from "@/lib/blocks";
import { getDigest } from "@/lib/digest";
import { getLikedSet } from "@/lib/likes";
import { getSharedSet } from "@/lib/shares";
import { createClient } from "@/lib/supabase/server";

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

  // Reviews by people the viewer has blocked are left out
  const blocked = await getBlockedIds(supabase, viewerId);
  const shown = logs.filter((l) => !blocked.has(l.user_id));

  const [liked, shared] = await Promise.all([
    getLikedSet(supabase, viewerId, shown),
    getSharedSet(
      supabase,
      viewerId,
      "log",
      shown.map((l) => l.id),
    ),
  ]);

  return {
    cards: shown.map((row) => ({
      key: row.id,
      card: (
        <DigestCard
          row={row}
          viewerId={viewerId}
          liked={liked.has(row.id)}
          shared={shared.has(row.id)}
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
