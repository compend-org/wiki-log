// ABOUTME: Server action that renders a home page feed tab when it is first opened.
// ABOUTME: Kept apart from feedActions, which FeedPages imports, because this one imports Feed.
"use server";

import { createElement, type ReactNode } from "react";
import Digest from "@/components/Digest";
import Feed from "@/components/Feed";
import type { FeedTab } from "@/components/FeedTabs";
import { FEED_MODES } from "@/components/loadFeedPage";

export async function loadFeedTab(tab: FeedTab): Promise<ReactNode> {
  if (tab === "digest") return createElement(Digest);
  if (!FEED_MODES.includes(tab)) {
    throw new Error("That isn't a feed.");
  }
  return createElement(Feed, { mode: tab });
}
