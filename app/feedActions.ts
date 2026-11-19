// ABOUTME: Server action that loads the later pages of a feed.
// ABOUTME: Checks what the browser sent, then renders the page's cards for the viewer.
"use server";

import { getTranslations } from "next-intl/server";
import {
  FEED_MODES,
  type FeedMode,
  type FeedPage,
  loadFeedPage,
} from "@/components/feed/loadFeedPage";
import { parseFeedCursor, parseSnapshot } from "@/lib/paging";

export async function loadMoreFeed(
  mode: FeedMode,
  asOf: string,
  cursor: unknown,
): Promise<FeedPage> {
  const t = await getTranslations();
  const snapshot = parseSnapshot(asOf);
  const parsed = parseFeedCursor(cursor);
  if (!FEED_MODES.includes(mode) || !snapshot || !parsed) {
    throw new Error(t("errors.notAPageOfFeed"));
  }
  return loadFeedPage(mode, snapshot, parsed);
}
