// ABOUTME: Loads the lists that include one item, most recently added first.
// ABOUTME: Shown in the "In Lists" section of an item page, a page at a time.
import { LIST_SELECT, type ListRow, type Thumb } from "@/lib/feedData";
import { createClient } from "@/lib/supabase/server";

// How many of each list's first items to show on its card
const PREVIEW_ITEMS = 12;

type PreviewRow = { position: number; items: Thumb | null };

export type ItemListRow = ListRow & { preview: PreviewRow[] };

// The first `limit` lists, and whether there are more after them
export async function getItemLists(itemId: string, limit: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("list_items")
    .select(
      `lists(${LIST_SELECT}, preview:list_items(position, items(title, image_url)))`,
    )
    .eq("item_id", itemId)
    .lte("lists.preview.position", PREVIEW_ITEMS)
    .order("added_at", { ascending: false })
    .order("position", { referencedTable: "lists.preview" })
    .limit(limit + 1);

  const rows = (data ?? []) as unknown as { lists: ItemListRow | null }[];
  return {
    lists: rows.slice(0, limit).flatMap((r) => (r.lists ? [r.lists] : [])),
    hasMore: rows.length > limit,
    error: error?.message ?? "",
  };
}
