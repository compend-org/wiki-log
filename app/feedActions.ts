// ABOUTME: Server action that loads the later pages of a feed.
// ABOUTME: Checks what the browser sent, then renders the page's cards for the viewer.
"use server";

import {
  FEED_MODES,
  type FeedMode,
  type FeedPage,
  loadFeedPage,
} from "@/components/loadFeedPage";
import { parseFeedCursor, parseSnapshot } from "@/lib/paging";

export async function loadMoreFeed(
  mode: FeedMode,
  asOf: string,
  cursor: unknown,
): Promise<FeedPage> {
  const snapshot = parseSnapshot(asOf);
  const parsed = parseFeedCursor(cursor);
  if (!FEED_MODES.includes(mode) || !snapshot || !parsed) {
    throw new Error("That isn't a page of a feed.");
  }
  return loadFeedPage(mode, snapshot, parsed);
}
