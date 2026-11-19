// ABOUTME: Finds the item a new list should start with, when it is made from an item's "Add to list".
// ABOUTME: The item comes in the address (/list/new?add=Q42) and is looked up, so only a real item is used.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GroupEntry } from "@/lib/lists/listGroups";

// What the address says to add: one item id, or nothing. Anything else
// (several, empty, or absurdly long) is ignored.
export function addParam(value: string | string[] | undefined): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return id.length > 0 && id.length <= 100 ? id : null;
}

// The item as a list entry, or null when there is no such item
export async function fetchNewListItem(
  supabase: SupabaseClient,
  itemId: string | null,
): Promise<GroupEntry | null> {
  if (!itemId) return null;
  const { data } = await supabase
    .from("items")
    .select("id, title, image_url, image_hidden")
    .eq("id", itemId)
    .maybeSingle();
  if (!data) return null;
  return {
    itemId: data.id,
    title: data.title,
    imageUrl: data.image_hidden ? null : (data.image_url ?? null),
  };
}
