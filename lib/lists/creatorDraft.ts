// ABOUTME: What a half-made list carries between the plain and grouped list editors: its title, description, items, their notes and pictures.
// ABOUTME: Switching the kind of list keeps all of it; a plain list's items go into the first group and a grouped list's are flattened.
import { type DraftGroup, emptyGroup } from "@/lib/lists/listGroups";

export type DraftItem = {
  itemId: string;
  title: string;
  imageUrl: string | null;
  note: string | null;
};

export type CreatorDraft = {
  title: string;
  description: string;
  // All the items, in the order they are shown
  items: DraftItem[];
  // Pictures picked from the items' articles, by item
  pictures: Record<string, string>;
};

export const EMPTY_DRAFT: CreatorDraft = {
  title: "",
  description: "",
  items: [],
  pictures: {},
};

// A plain list's items as grouped ones: one group holding every item
export function groupsFromDraft(draft: CreatorDraft): DraftGroup[] {
  return draft.items.length > 0
    ? [{ ...emptyGroup(), items: draft.items }]
    : [];
}

// A grouped list's items as a plain list's: every group's items, in order
export function flattenGroups(groups: DraftGroup[]): DraftItem[] {
  return groups.flatMap((g) =>
    g.items.map((i) => ({ ...i, note: i.note ?? null })),
  );
}

// The pictures worth keeping: the ones picked, not the ones taken back
export function keptPictures(
  pictures: Record<string, string | null>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(pictures).filter(
      (entry): entry is [string, string] => entry[1] !== null,
    ),
  );
}
