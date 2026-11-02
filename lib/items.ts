import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

// For item pages. Call after `await connection()`, since it reads the clock.
export async function getItemForPage(id: string): Promise<LookupResult> {
  if (!/^Q\d+$/.test(id)) return { error: "Invalid item." };

  const supabase = await createClient();
  const { data } = await supabase
    .from("items")
    .select(
      "id, title, description, image_url, image_non_free, image_page_url, image_hidden, page_url, fetched_at"
    )
    .eq("id", id)
    .maybeSingle();
  const cached = data as ItemRow | null;

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
  const hidden = cached?.image_hidden === true;
  const item: ItemData = hidden
    ? { ...fresh.item, imageUrl: null, imageNonFree: false, imageFilePage: null }
    : fresh.item;

  if (cached) {
    await createAdminClient()
      .from("items")
      .update({
        title: item.title,
        description: item.description,
        image_url: item.imageUrl,
        image_non_free: item.imageNonFree,
        image_page_url: item.imageFilePage,
        page_url: item.pageUrl,
        fetched_at: new Date().toISOString(),
      })
      .eq("id", id);
  }

  return { item };
}