// ABOUTME: Server actions that load later pages of the paged sections about one item.
// ABOUTME: Check what the browser sent, then render the page's cards for the viewer.
"use server";

import type { CardsPage } from "@/components/CardPages";
import {
  loadItemListsPage,
  loadItemLogsPage,
  loadLikedReviewsPage,
} from "@/components/loadItemPages";
import { ITEM_ID_PATTERN, isUuid } from "@/lib/ids";
import { parseKeyset } from "@/lib/paging";

function isItemId(value: unknown): value is string {
  return typeof value === "string" && ITEM_ID_PATTERN.test(value);
}

export async function loadMoreItemLogs(
  itemId: unknown,
  exclude: unknown,
  cursor: unknown,
): Promise<CardsPage> {
  const after = parseKeyset(cursor);
  if (
    !isItemId(itemId) ||
    !Array.isArray(exclude) ||
    exclude.length > 50 ||
    !exclude.every((id) => typeof id === "string" && isUuid(id)) ||
    !after
  ) {
    throw new Error("That isn't a page of an item's reviews.");
  }
  return loadItemLogsPage(itemId, exclude, after);
}

export async function loadMoreItemLists(
  itemId: unknown,
  cursor: unknown,
): Promise<CardsPage> {
  const after = parseKeyset(cursor);
  if (!isItemId(itemId) || !after) {
    throw new Error("That isn't a page of an item's lists.");
  }
  return loadItemListsPage(itemId, after);
}

export async function loadMoreLikedReviews(
  itemId: unknown,
  userId: unknown,
  cursor: unknown,
): Promise<CardsPage> {
  const after = parseKeyset(cursor);
  if (
    !isItemId(itemId) ||
    typeof userId !== "string" ||
    !isUuid(userId) ||
    !after
  ) {
    throw new Error("That isn't a page of liked reviews.");
  }
  return loadLikedReviewsPage(itemId, userId, after);
}
