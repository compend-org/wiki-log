// ABOUTME: Server actions that load a home page feed tab and the later pages of a feed.
// ABOUTME: Checks what the browser sent, then renders the feed or the page's cards for the viewer.
"use server";

import { createElement, type ReactNode } from "react";
import Feed, {
  type FeedMode,
  type FeedPage,
  loadFeedPage,
} from "@/components/Feed";
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

// A feed tab's first page, rendered when the tab is first opened
export async function loadFeedTab(mode: FeedMode): Promise<ReactNode> {
  if (!MODES.includes(mode)) {
    throw new Error("That isn't a feed.");
  }
  return createElement(Feed, { mode });
}
