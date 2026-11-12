// ABOUTME: Loads the lists that include one item, most recently added first.
// ABOUTME: Shown in the "In Lists" section of an item page, a page at a time.
import { LIST_SELECT, type ListRow, type Thumb } from "@/lib/feedData";
import { type Keyset, olderThan, PAGE_SIZE, pageOf } from "@/lib/paging";
import { createClient } from "@/lib/supabase/server";

// How many of each list's first items to show on its card
const PREVIEW_ITEMS = 12;

type PreviewRow = { position: number; items: Thumb | null };

export type ItemListRow = ListRow & { preview: PreviewRow[] };

// One page of lists after `after`, and where the next page starts
export async function getItemLists(itemId: string, after: Keyset | null) {
  const supabase = await createClient();
  let query = supabase
    .from("list_items")
    .select(
      `added_at, list_id, lists(${LIST_SELECT}, preview:list_items(position, items(title, image_url)))`,
    )
    .eq("item_id", itemId)
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
      lists: ItemListRow | null;
    }[],
    (r) => ({ at: r.added_at, id: r.list_id }),
  );
  return {
    // Lists the viewer can't see come back empty and are left out
    lists: page.flatMap((r) => (r.lists ? [r.lists] : [])),
    next,
    error: error?.message ?? "",
  };
}
