// ABOUTME: What an unpublished log entry or list holds, and the checks on a list draft's items.
// ABOUTME: Shared by the editors that autosave drafts, the actions that store them and the pages that load them.
import { ITEM_ID_PATTERN } from "@/lib/ids";
import { MAX_GROUP_NAME, MAX_GROUPS } from "@/lib/lists/listGroups";
import { noteProblem } from "@/lib/lists/listNotes";

// Why a list draft can't be stored, as the key of its message under "errors"
export type ListDraftProblem =
  | "invalidDraft"
  | "titleLength"
  | "descriptionLength"
  | "invalidGroups"
  | "invalidItems"
  | "invalidNotes"
  | "invalidPictures";

// Matches the limits on published lists
export const MAX_DRAFT_ITEMS = 10000;
const MAX_URL_LENGTH = 2000;

// What answers a request to store a draft: when it was saved, which later
// saves must name; that it was changed or deleted elsewhere since the version
// the request names; or why it couldn't be stored
export type DraftSaveResult =
  | { savedAt: string }
  | { conflict: true }
  | { error: string };

// A log entry being written for an item
export type LogDraft = {
  rating: number | null;
  review: string;
  // A picture picked from the item's article, and the page crediting it
  imageUrl: string | null;
  imageFilePage: string | null;
  savedAt: string;
};

// A list's items as a draft stores them. A plain list has one group, whose
// name is unused. Notes and pictures picked from the items' articles are by
// item.
export type ListDraftContent = {
  groups: { name: string; items: string[] }[];
  notes: Record<string, string>;
  pictures: Record<string, string>;
};

// A list draft's details and items
export type ListDraftFields = {
  grouped: boolean;
  title: string;
  description: string;
  ranked: boolean;
  labeled: boolean;
  content: ListDraftContent;
};

function isRecordOfStrings(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((v) => typeof v === "string")
  );
}

// Why the draft's details and items can't be stored, or null if they can.
// A draft may be untitled or empty; it is checked in full when published.
export function listDraftProblem(fields: unknown): ListDraftProblem | null {
  if (typeof fields !== "object" || fields === null) return "invalidDraft";
  const f = fields as Record<string, unknown>;
  if (
    typeof f.grouped !== "boolean" ||
    typeof f.ranked !== "boolean" ||
    typeof f.labeled !== "boolean" ||
    typeof f.title !== "string" ||
    typeof f.description !== "string"
  ) {
    return "invalidDraft";
  }
  if (f.title.length > 80) return "titleLength";
  if (f.description.length > 500) return "descriptionLength";

  const content = f.content as Record<string, unknown> | null;
  if (
    typeof content !== "object" ||
    content === null ||
    !Array.isArray(content.groups) ||
    !isRecordOfStrings(content.notes) ||
    !isRecordOfStrings(content.pictures)
  ) {
    return "invalidDraft";
  }
  const groups = content.groups as unknown[];
  if (groups.length < 1 || groups.length > MAX_GROUPS) return "invalidGroups";

  const items = new Set<string>();
  for (const group of groups) {
    const g = group as Record<string, unknown> | null;
    if (
      typeof g !== "object" ||
      g === null ||
      typeof g.name !== "string" ||
      g.name.length > MAX_GROUP_NAME ||
      !Array.isArray(g.items)
    ) {
      return "invalidGroups";
    }
    for (const id of g.items) {
      if (
        typeof id !== "string" ||
        !ITEM_ID_PATTERN.test(id) ||
        items.has(id)
      ) {
        return "invalidItems";
      }
      items.add(id);
    }
  }
  if (items.size > MAX_DRAFT_ITEMS) return "invalidItems";

  for (const [id, note] of Object.entries(content.notes)) {
    if (!items.has(id) || noteProblem(note)) return "invalidNotes";
  }
  for (const [id, url] of Object.entries(content.pictures)) {
    if (!items.has(id) || url.length > MAX_URL_LENGTH) {
      return "invalidPictures";
    }
  }
  return null;
}
