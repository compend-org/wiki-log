// ABOUTME: Server action that loads the next page of a home page feed.
// ABOUTME: Checks what the browser sent, then renders the page's cards for the viewer.
"use server";

import { type FeedMode, type FeedPage, loadFeedPage } from "@/components/Feed";
import { FEATURES } from "@/lib/features";
import { parseFeedCursor, parseSnapshot } from "@/lib/paging";

const MODES: FeedMode[] = [
  "following",
  "everyone",
  ...(FEATURES.trending ? (["trending"] as const) : []),
];

export async function loadMoreFeed(
  mode: FeedMode,
  asOf: string,
  cursor: unknown,
): Promise<FeedPage> {
  const snapshot = parseSnapshot(asOf);
  const parsed = parseFeedCursor(cursor);
  if (!MODES.includes(mode) || !snapshot || !parsed) {
    throw new Error("That isn't a page of a feed.");
  }
  return loadFeedPage(mode, snapshot, parsed);
}
