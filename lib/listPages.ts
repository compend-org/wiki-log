// ABOUTME: Loads a list's items one page at a time, with each item's rank.
// ABOUTME: Lists hold up to 10,000 items but the API returns at most 1,000 rows.
import type { SupabaseClient } from "@supabase/supabase-js";

// Items per page of a list. It divides by 3 and 4, so every row of the grid is
// full on phones and wider screens alike.
export const LIST_PAGE_SIZE = 120;

export type ListPageEntry = {
  itemId: string;
  // 1-based place in the whole list
  rank: number;
  title: string;
  imageUrl: string | null;
  imageHidden: boolean;
  nsfw: boolean;
};

type EntryRow = {
  item_id: string;
  items: {
    title: string;
    image_url: string | null;
    image_hidden: boolean;
    nsfw: boolean;
  } | null;
};

// The page asked for in a URL: a whole number from 1, or 1 when it's anything
// else
export function parsePage(value: string | string[] | undefined): number {
  if (typeof value !== "string" || !/^[1-9][0-9]{0,5}$/.test(value)) return 1;
  return Number(value);
}

// How many pages a list of `total` items fills (an empty list still has one)
export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
}

// The page that holds the item at `rank`
export function pageOfRank(rank: number): number {
  return Math.max(1, Math.ceil(rank / LIST_PAGE_SIZE));
}

// The zero-based first and last rows of a page, for .range()
export function pageRange(page: number): { from: number; to: number } {
  const from = (page - 1) * LIST_PAGE_SIZE;
  return { from, to: from + LIST_PAGE_SIZE - 1 };
}

// The page links to show: the first and last pages, and the ones either side
// of the current one, with null where pages are skipped
export function pagerPages(current: number, last: number): (number | null)[] {
  const wanted = new Set([1, last, current - 1, current, current + 1]);
  const pages = [...wanted]
    .filter((p) => p >= 1 && p <= last)
    .sort((a, b) => a - b);
  const out: (number | null)[] = [];
  for (const p of pages) {
    const before = out.at(-1);
    // A gap of a single page is shown as that page rather than a gap
    if (typeof before === "number" && p - before === 2) out.push(before + 1);
    else if (typeof before === "number" && p - before > 2) out.push(null);
    out.push(p);
  }
  return out;
}

// One page of a list's items in order, and how many the list holds in all.
// Ties in position (which shouldn't happen) are broken by item, so pages never
// overlap or skip an item.
export async function fetchListPage(
  supabase: SupabaseClient,
  listId: string,
  page: number,
): Promise<{ entries: ListPageEntry[]; total: number; error?: string }> {
  const { from, to } = pageRange(page);
  const { data, count, error } = await supabase
    .from("list_items")
    .select("item_id, items(title, image_url, image_hidden, nsfw)", {
      count: "exact",
    })
    .eq("list_id", listId)
    .order("position")
    .order("item_id")
    .range(from, to);
  // A page past the end is refused (416) rather than coming back empty, so
  // count the list on its own to say where it ends
  if (error?.code === "PGRST103") {
    const counted = await supabase
      .from("list_items")
      .select("item_id", { count: "exact", head: true })
      .eq("list_id", listId);
    if (counted.error) {
      return { entries: [], total: 0, error: counted.error.message };
    }
    return { entries: [], total: counted.count ?? 0 };
  }
  if (error) return { entries: [], total: 0, error: error.message };

  const entries = ((data ?? []) as unknown as EntryRow[]).map((row, i) => ({
    itemId: row.item_id,
    rank: from + i + 1,
    title: row.items?.title ?? "Unknown item",
    imageUrl: row.items?.image_url ?? null,
    imageHidden: row.items?.image_hidden ?? false,
    nsfw: row.items?.nsfw ?? false,
  }));
  return { entries, total: count ?? entries.length };
}
