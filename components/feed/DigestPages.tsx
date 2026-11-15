"use client";

// ABOUTME: Shows the digest's pages one after another and loads the next as the bottom nears.
// ABOUTME: The first page comes from the server; each later page that loads is counted for analytics.

import { loadMoreDigest } from "@/app/digestActions";
import type { DigestPage } from "@/components/feed/loadDigestPage";
import CardPages from "@/components/paging/CardPages";
import { track } from "@/lib/analytics/analytics";

export default function DigestPages({ first }: { first: DigestPage }) {
  return (
    // One column, kept narrow in the wide feed area
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <CardPages
        first={first}
        loadMore={loadMoreDigest}
        onPageLoaded={(page) =>
          track("feed_more_loaded", { feed: "digest", page })
        }
      />
    </div>
  );
}
