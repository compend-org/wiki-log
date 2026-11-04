// ABOUTME: Reads items from the database cache and refreshes stale ones from Wikipedia.
// ABOUTME: Holds the rules for how a Wikipedia lookup becomes an `items` row.
import { ITEM_ID_PATTERN, isCompoundId } from "@/lib/ids";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getItemById, type ItemData, type LookupResult } from "@/lib/wikipedia";

// A cached item is trusted for a week, then refreshed from Wikipedia
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type ItemRow = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  image_non_free: boolean;
  image_page_url: string | null;
  image_hidden: boolean;
  page_url: string;
  fetched_at: string;
};

function toItem(row: ItemRow): ItemData {
  const hidden = row.image_hidden;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    imageUrl: hidden ? null : row.image_url,
    imageNonFree: hidden ? false : row.image_non_free,
    imageFilePage: hidden ? null : row.image_page_url,
    pageUrl: row.page_url,
  };
}

// An item from Wikipedia, without its image if that image is hidden
export function applyImageHidden(item: ItemData, hidden: boolean): ItemData {
  return hidden
    ? { ...item, imageUrl: null, imageNonFree: false, imageFilePage: null }
    : item;
}

// The `items` columns written when an item is saved or refreshed from Wikipedia
export function itemColumns(item: ItemData) {
  return {
    title: item.title,
    description: item.description,
    image_url: item.imageUrl,
    image_non_free: item.imageNonFree,
    image_page_url: item.imageFilePage,
    page_url: item.pageUrl,
    fetched_at: new Date().toISOString(),
  };
}

// For item pages. Call after `await connection()`, since it reads the clock.
export async function getItemForPage(id: string): Promise<LookupResult> {
  if (!ITEM_ID_PATTERN.test(id)) return { error: "Invalid item." };

  const supabase = await createClient();
  const { data } = await supabase
    .from("items")
    .select(
      "id, title, description, image_url, image_non_free, image_page_url, image_hidden, page_url, fetched_at",
    )
    .eq("id", id)
    .maybeSingle();
  const cached = data as ItemRow | null;

  // Compounds live only in our database
  if (isCompoundId(id)) {
    return cached ? { item: toItem(cached) } : { error: "Unknown compound." };
  }

  if (
    cached &&
    Date.now() - new Date(cached.fetched_at).getTime() < MAX_AGE_MS
  ) {
    return { item: toItem(cached) };
  }

  const fresh = await getItemById(id);

  if ("error" in fresh) {
    // Wikipedia is down or the article was removed: a stale copy beats an error
    return cached ? { item: toItem(cached) } : fresh;
  }

  // A hidden image stays hidden, however often the item is refreshed
  const item = applyImageHidden(fresh.item, cached?.image_hidden === true);

  if (cached) {
    await createAdminClient()
      .from("items")
      .update(itemColumns(item))
      .eq("id", id);
  }

  return { item };
}
