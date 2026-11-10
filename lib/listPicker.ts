// ABOUTME: Loads the signed-in person's lists a page at a time for the "Add to list" picker.
// ABOUTME: Says for each whether it already holds the item, without sending any list ids.
import type { SupabaseClient } from "@supabase/supabase-js";

// Lists shown at first, and how many more each "Show more lists" adds
const PICKER_PAGE_SIZE = 50;

export type PickerList = {
  id: string;
  title: string;
  ranked: boolean;
  count: number;
  // Whether the list already holds the item
  has: boolean;
};

type Row = {
  id: string;
  title: string;
  ranked: boolean;
  item_count: number | string;
  has_item: boolean;
  total: number | string;
};

// The viewer's lists from `offset` on, newest first, whose titles contain
// `search` (any case), and how many lists match in all. `total` is null when
// the page came back empty past the start, where the total can't be read.
export async function fetchPickerLists(
  supabase: SupabaseClient,
  itemId: string,
  search: string,
  offset: number,
): Promise<{ lists: PickerList[]; total: number | null; error?: string }> {
  const { data, error } = await supabase.rpc("my_lists_for_item", {
    p_item_id: itemId,
    p_search: search.trim(),
    p_offset: offset,
    p_limit: PICKER_PAGE_SIZE,
  });
  if (error) return { lists: [], total: null, error: error.message };
  const rows = (data ?? []) as Row[];
  return {
    lists: rows.map((r) => ({
      id: r.id,
      title: r.title,
      ranked: r.ranked,
      count: Number(r.item_count),
      has: r.has_item,
    })),
    total: rows.length > 0 ? Number(rows[0].total) : offset === 0 ? 0 : null,
  };
}

// The lists shown so far with a later page added on. A list already shown
// (which happens if one was made while paging) isn't shown twice.
export function appendLists(
  shown: PickerList[],
  more: PickerList[],
): PickerList[] {
  const have = new Set(shown.map((l) => l.id));
  return [...shown, ...more.filter((l) => !have.has(l.id))];
}
