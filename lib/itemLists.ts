// ABOUTME: Loads the lists that include one item, most recently added first.
// ABOUTME: Shown in the "In Lists" section of an item page.
import { LIST_SELECT, type ListRow, type Thumb } from "@/lib/feedData";
import { createClient } from "@/lib/supabase/server";

// How many lists to show for one item
const MAX_LISTS = 12;

// How many of each list's first items to show on its card
const PREVIEW_ITEMS = 12;

type PreviewRow = { position: number; items: Thumb | null };

export type ItemListRow = ListRow & { preview: PreviewRow[] };

export async function getItemLists(itemId: string) {
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
    .limit(MAX_LISTS);

  const rows = (data ?? []) as unknown as { lists: ItemListRow | null }[];
  return {
    lists: rows.flatMap((r) => (r.lists ? [r.lists] : [])),
    error: error?.message ?? "",
  };
}
