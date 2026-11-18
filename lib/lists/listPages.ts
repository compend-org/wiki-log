// ABOUTME: Loads a list's items, or a review list's reviews, one page at a time, with each one's rank.
// ABOUTME: Lists hold up to 10,000 items but the API returns at most 1,000 rows.
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadMessage } from "@/lib/errors/userFacingErrorMessage";
import { MAX_GROUPED_ITEMS, type SavedGroup } from "@/lib/lists/listGroups";

// Items per page of a list. It divides by 3 and 4, so every row of the grid is
// full on phones and wider screens alike.
export const LIST_PAGE_SIZE = 120;

// The review a review list's entry is for
export type ListPageReview = {
  logId: string;
  authorId: string;
  username: string;
  avatarPath: string | null;
  text: string;
  rating: number | null;
  loggedAt: string;
};

export type ListPageEntry = {
  // The entry itself, as an item can be in a review list more than once
  entryId: string;
  itemId: string;
  // 1-based place in the whole list
  rank: number;
  title: string;
  // The picture the list's owner chose, or else the item's own
  imageUrl: string | null;
  // Whether the item's own picture is hidden; a chosen picture never is
  imageHidden: boolean;
  nsfw: boolean;
  // The group a grouped list's item is in
  groupId: string | null;
  // Why the list's owner put the item on the list, if they said
  note: string | null;
  // In a review list, the review; null in an item list, and for a review the
  // viewer can't see (removed, or by a banned author)
  review: ListPageReview | null;
};

type EntryRow = {
  id: string;
  item_id: string;
  group_id: string | null;
  // The picture the list's owner chose; null shows the item's
  image_url: string | null;
  note: string | null;
  items: {
    title: string;
    image_url: string | null;
    image_hidden: boolean;
    nsfw: boolean;
  } | null;
  logs: {
    id: string;
    user_id: string;
    review: string;
    rating: number | string | null;
    logged_at: string;
    image_url: string | null;
    profiles: { username: string; avatar_path: string | null } | null;
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
    .select(
      "id, item_id, group_id, image_url, note, items(title, image_url, image_hidden, nsfw), logs(id, user_id, review, rating, logged_at, image_url, profiles!logs_user_id_profiles_fkey(username, avatar_path))",
      {
        count: "exact",
      },
    )
    .eq("list_id", listId)
    .order("position")
    .order("item_id")
    .order("id")
    .range(from, to);
  // A page past the end is refused (416) rather than coming back empty, so
  // count the list on its own to say where it ends
  if (error?.code === "PGRST103") {
    const counted = await supabase
      .from("list_items")
      .select("item_id", { count: "exact", head: true })
      .eq("list_id", listId);
    if (counted.error) {
      return { entries: [], total: 0, error: loadMessage(counted.error) };
    }
    return { entries: [], total: counted.count ?? 0 };
  }
  if (error) return { entries: [], total: 0, error: loadMessage(error) };

  const entries = ((data ?? []) as unknown as EntryRow[]).map((row, i) => {
    // A review's chosen picture stands in for the item's, as an entry's does
    const chosen = row.image_url ?? row.logs?.image_url ?? null;
    return {
      entryId: row.id,
      itemId: row.item_id,
      rank: from + i + 1,
      title: row.items?.title ?? "Unknown item",
      imageUrl: chosen ?? row.items?.image_url ?? null,
      imageHidden: chosen ? false : (row.items?.image_hidden ?? false),
      nsfw: row.items?.nsfw ?? false,
      groupId: row.group_id ?? null,
      note: row.note ?? null,
      review: row.logs?.profiles
        ? {
            logId: row.logs.id,
            authorId: row.logs.user_id,
            username: row.logs.profiles.username,
            avatarPath: row.logs.profiles.avatar_path,
            text: row.logs.review,
            rating: row.logs.rating === null ? null : Number(row.logs.rating),
            loggedAt: row.logs.logged_at,
          }
        : null,
    };
  });
  return { entries, total: count ?? entries.length };
}

// A grouped list's groups, in order
export async function fetchGroups(
  supabase: SupabaseClient,
  listId: string,
): Promise<SavedGroup[]> {
  const { data } = await supabase
    .from("list_groups")
    .select("id, name")
    .eq("list_id", listId)
    .order("position");
  return (data ?? []) as SavedGroup[];
}

// All of a grouped list's items in order (it holds at most 300, a few pages),
// for editing
export async function fetchGroupedEntries(
  supabase: SupabaseClient,
  listId: string,
): Promise<{ entries: ListPageEntry[]; error?: string }> {
  const entries: ListPageEntry[] = [];
  for (let page = 1; page <= pageCount(MAX_GROUPED_ITEMS); page++) {
    const result = await fetchListPage(supabase, listId, page);
    if (result.error) return { entries: [], error: result.error };
    entries.push(...result.entries);
    if (entries.length >= result.total) break;
  }
  return { entries };
}
