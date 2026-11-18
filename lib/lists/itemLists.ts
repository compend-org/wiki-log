// ABOUTME: Loads the lists that include one item, or one review, most recently added first.
// ABOUTME: Shown in an item page's "In Lists" section and a review's lists page, a page at a time.

import { loadMessage } from "@/lib/errors/userFacingErrorMessage";
import { LIST_SELECT, type ListRow, type Thumb } from "@/lib/feed/feedData";
import { type Keyset, olderThan, PAGE_SIZE, pageOf } from "@/lib/paging";
import { createClient } from "@/lib/supabase/server";

// How many of each list's first items to show on its card
const PREVIEW_ITEMS = 12;

// The entry's chosen picture in image_url; null shows the item's
type PreviewRow = {
  position: number;
  image_url: string | null;
  items: Thumb | null;
};

export type ItemListRow = ListRow & { preview: PreviewRow[] };

// One page of the item lists holding an item, after `after`, and where the
// next page starts
export function getItemLists(itemId: string, after: Keyset | null) {
  return getListsHolding({ itemId }, after);
}

// One page of the review lists holding a review, after `after`, and where the
// next page starts
export function getReviewLists(logId: string, after: Keyset | null) {
  return getListsHolding({ logId }, after);
}

async function getListsHolding(
  entry: { itemId: string } | { logId: string },
  after: Keyset | null,
) {
  const supabase = await createClient();
  let query = supabase
    .from("list_items")
    .select(
      `added_at, list_id, lists(${LIST_SELECT}, preview:list_items(position, image_url, items(title, image_url, nsfw)))`,
    )
    .lte("lists.preview.position", PREVIEW_ITEMS);
  query =
    "logId" in entry
      ? query.eq("log_id", entry.logId)
      : query.eq("item_id", entry.itemId).is("log_id", null);
  if (after) query = query.or(olderThan("added_at", after, "list_id"));
  const { data, error } = await query
    .order("added_at", { ascending: false })
    .order("list_id", { ascending: false })
    .order("position", { referencedTable: "lists.preview" })
    .limit(PAGE_SIZE + 1);

  const { page, next } = pageOf(
    (data ?? []) as unknown as {
      added_at: string;
      list_id: string;
      lists: ItemListRow | null;
    }[],
    (r) => ({ at: r.added_at, id: r.list_id }),
  );
  return {
    // Lists the viewer can't see come back empty and are left out
    lists: page.flatMap((r) => (r.lists ? [r.lists] : [])),
    next,
    error: loadMessage(error),
  };
}
