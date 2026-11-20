// ABOUTME: Loads one of the signed-in person's list drafts for the new-list page to carry on with.
// ABOUTME: Reads each item's current title and picture; items that no longer exist are left out.
import type { SupabaseClient } from "@supabase/supabase-js";
import { chunks } from "@/lib/allRows";
import type { ListDraftContent } from "@/lib/drafts";
import { shownImage } from "@/lib/format";

// How many items are looked up per request, to keep each address short
const ITEMS_AT_ONCE = 200;

export type ListDraftEntry = {
  itemId: string;
  title: string;
  // The picture picked for the item, or else its own
  imageUrl: string | null;
  note: string | null;
};

export type OpenedListDraft = {
  id: string;
  savedAt: string;
  grouped: boolean;
  title: string;
  description: string;
  ranked: boolean;
  labeled: boolean;
  groups: { name: string; items: ListDraftEntry[] }[];
  pictures: Record<string, string>;
};

type ItemRow = {
  id: string;
  title: string;
  image_url: string | null;
  image_hidden: boolean;
};

// The draft, or null if it isn't one of the signed-in person's
export async function getListDraft(
  supabase: SupabaseClient,
  id: string,
): Promise<OpenedListDraft | null> {
  const { data: draft } = await supabase
    .from("list_drafts")
    .select(
      "id, saved_at, grouped, title, description, ranked, labeled, content",
    )
    .eq("id", id)
    .maybeSingle();
  if (!draft) return null;

  const content = draft.content as ListDraftContent;
  const ids = content.groups.flatMap((g) => g.items);
  const found = await Promise.all(
    chunks(ids, ITEMS_AT_ONCE).map(async (batch) => {
      const { data, error } = await supabase
        .from("items")
        .select("id, title, image_url, image_hidden")
        .in("id", batch);
      if (error) throw new Error(`Couldn't load the draft: ${error.message}`);
      return (data ?? []) as ItemRow[];
    }),
  );
  const items = new Map(found.flat().map((item) => [item.id, item]));
  const pictures = Object.fromEntries(
    Object.entries(content.pictures).filter(([itemId]) => items.has(itemId)),
  );

  return {
    id: draft.id,
    savedAt: draft.saved_at,
    grouped: draft.grouped,
    title: draft.title,
    description: draft.description,
    ranked: draft.ranked,
    labeled: draft.labeled,
    groups: content.groups.map((group) => ({
      name: group.name,
      items: group.items.flatMap((itemId) => {
        const item = items.get(itemId);
        if (!item) return [];
        return [
          {
            itemId,
            title: item.title,
            imageUrl: pictures[itemId] ?? shownImage(item),
            note: content.notes[itemId] ?? null,
          },
        ];
      }),
    })),
    pictures,
  };
}
