// ABOUTME: Reads items from the database cache and refreshes stale ones, or ones whose image broke, from Wikipedia.
// ABOUTME: Holds the rules for how a Wikipedia lookup becomes an `items` row.
import { ITEM_ID_PATTERN, isCompoundId } from "@/lib/ids";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getItemById,
  HEADERS,
  type ItemData,
  type LookupResult,
} from "@/lib/wikipedia";

// A cached item is trusted for a week, then refreshed from Wikipedia
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// How long to wait on Wikipedia when a stale copy can stand in for the item
export const STALE_COPY_WAIT_MS = 3000;

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
  nsfw: boolean;
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
    types: null,
    nsfw: row.nsfw,
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
    nsfw: item.nsfw,
    fetched_at: new Date().toISOString(),
    ...(item.types ? { types: item.types } : {}),
  };
}

// For item pages. Call after `await connection()`, since it reads the clock.
export async function getItemForPage(id: string): Promise<LookupResult> {
  if (!ITEM_ID_PATTERN.test(id)) return { error: "Invalid item." };

  const supabase = await createClient();
  const { data } = await supabase
    .from("items")
    .select(
      "id, title, description, image_url, image_non_free, image_page_url, image_hidden, page_url, fetched_at, nsfw",
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

  if (!cached) return getItemById(id);

  // With a stale copy to fall back on, the page doesn't wait long on Wikipedia
  const fresh = await refreshItem(
    id,
    cached.image_hidden,
    Date.now() + STALE_COPY_WAIT_MS,
  );

  // Wikipedia is down or the article was removed: a stale copy beats an error
  return "error" in fresh ? { item: toItem(cached) } : fresh;
}

// Looks a cached item up on Wikipedia again and saves it over its row
async function refreshItem(
  id: string,
  imageHidden: boolean,
  deadline?: number,
): Promise<LookupResult> {
  const fresh = await getItemById(id, deadline);
  if ("error" in fresh) return fresh;

  // A hidden image stays hidden, however often the item is refreshed
  const item = applyImageHidden(fresh.item, imageHidden);

  // Don't mark an alias fresh with another item's data: future visits must
  // resolve it again so the page can redirect to the resolved ID.
  if (item.id === id) {
    await createAdminClient()
      .from("items")
      .update(itemColumns(item))
      .eq("id", id);
  }

  return { item };
}

// Where Wikimedia serves the images we store for items
const WIKIMEDIA_IMAGE = /^https:\/\/(upload|thumb)\.wikimedia\.org\//;

// Wikimedia can rename or delete a file, and the image address we stored then
// stops working. For an image a browser couldn't load, checks that it is
// really gone, then refreshes the items that show it. Returns the image to
// show instead, or null when there isn't one.
export async function replaceBrokenImage(url: string): Promise<string | null> {
  if (!WIKIMEDIA_IMAGE.test(url)) return null;

  const { data } = await createAdminClient()
    .from("items")
    .select("id, image_hidden")
    .eq("image_url", url)
    .limit(5);
  const rows = (data ?? []) as Pick<ItemRow, "id" | "image_hidden">[];
  if (rows.length === 0) return null;

  // Only an image Wikimedia says is missing is replaced, so a browser's
  // network trouble can't make us look items up again
  const check = await fetch(url, { method: "HEAD", headers: HEADERS }).catch(
    () => null,
  );
  if (check?.status !== 404) return null;

  let replacement: string | null = null;
  for (const row of rows) {
    const fresh = await refreshItem(row.id, row.image_hidden);
    if ("item" in fresh) replacement ??= fresh.item.imageUrl;
  }
  return replacement;
}
