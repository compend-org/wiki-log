"use client";

// ABOUTME: Shows the digest's pages one after another and loads the next as the bottom nears.
// ABOUTME: The first page comes from the server; each later page that loads is counted for analytics.

import { loadMoreDigest } from "@/app/digestActions";
import CardPages from "@/components/CardPages";
import type { DigestPage } from "@/components/loadDigestPage";
import { track } from "@/lib/analytics";

export default function DigestPages({ first }: { first: DigestPage }) {
  return (
    <div className="flex flex-col gap-4">
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
