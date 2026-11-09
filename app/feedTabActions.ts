// ABOUTME: Server action that renders a home page feed tab when it is first opened.
// ABOUTME: Kept apart from feedActions, which FeedPages imports, because this one imports Feed.
"use server";

import { createElement, type ReactNode } from "react";
import Feed from "@/components/Feed";
import { FEED_MODES, type FeedMode } from "@/components/loadFeedPage";

export async function loadFeedTab(mode: FeedMode): Promise<ReactNode> {
  if (!FEED_MODES.includes(mode)) {
    throw new Error("That isn't a feed.");
  }
  return createElement(Feed, { mode });
}
