// ABOUTME: Loads the lists that include one item, most recently added first.
// ABOUTME: Shown in the "In Lists" section of an item page, a page at a time.

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

// One page of lists after `after`, and where the next page starts. Lists by
// people the viewer has blocked are left out: the viewer's block of the owner
// is the only one they can read, so a list is kept when there isn't one.
export async function getItemLists(itemId: string, after: Keyset | null) {
  const supabase = await createClient();
  let query = supabase
    .from("list_items")
    .select(
      `added_at, list_id, lists!inner(${LIST_SELECT}, preview:list_items(position, image_url, items(title, image_url, nsfw)), owner:profiles!lists_user_id_profiles_fkey!inner(viewer_block:blocks!blocks_blocked_id_fkey()))`,
    )
    .eq("item_id", itemId)
    .is("lists.owner.viewer_block", null)
    .lte("lists.preview.position", PREVIEW_ITEMS);
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
      lists: ItemListRow;
    }[],
    (r) => ({ at: r.added_at, id: r.list_id }),
  );
  return {
    // Lists the viewer can't see aren't returned at all
    lists: page.map((r) => r.lists),
    next,
    error: loadMessage(error),
  };
}
