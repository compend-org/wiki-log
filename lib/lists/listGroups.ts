// ABOUTME: Pure helpers for grouped lists: editing draft groups and sorting a list's items into them.
// ABOUTME: Groups are unordered buckets; the groups are in order, the items inside them are not.

import { FEATURES } from "@/lib/features";

// A grouped list holds at most this many groups and items (the database
// enforces the same limits)
export const MAX_GROUPS = 30;
export const MAX_GROUPED_ITEMS = 300;
export const MAX_GROUP_NAME = 60;

export type GroupEntry = {
  itemId: string;
  title: string;
  imageUrl: string | null;
};

// A group being edited. The key is local, so groups can be told apart before
// they have an ID, and while their names are being typed.
export type DraftGroup = {
  key: string;
  name: string;
  items: GroupEntry[];
};

export type SavedGroup = { id: string; name: string | null };

let nextKey = 0;
function newGroupKey(): string {
  nextKey += 1;
  return `g${nextKey}`;
}

export function emptyGroup(name = ""): DraftGroup {
  return { key: newGroupKey(), name, items: [] };
}

export function groupItemCount(groups: DraftGroup[]): number {
  return groups.reduce((n, g) => n + g.items.length, 0);
}

function hasItem(groups: DraftGroup[], itemId: string): boolean {
  return groups.some((g) => g.items.some((i) => i.itemId === itemId));
}

// Puts an item in a group, or in the last one. An item already in the list
// stays where it is.
export function addEntry(
  groups: DraftGroup[],
  entry: GroupEntry,
  toKey?: string,
): DraftGroup[] {
  if (groups.length === 0 || hasItem(groups, entry.itemId)) return groups;
  const target = groups.some((g) => g.key === toKey)
    ? toKey
    : groups[groups.length - 1].key;
  return groups.map((g) =>
    g.key === target ? { ...g, items: [...g.items, entry] } : g,
  );
}

export function removeEntry(
  groups: DraftGroup[],
  itemId: string,
): DraftGroup[] {
  return groups.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.itemId !== itemId),
  }));
}

// The key of the group a drag target belongs to: the group itself, or the
// group holding that item
export function groupKeyOf(groups: DraftGroup[], id: string): string | null {
  const group = groups.find(
    (g) => g.key === id || g.items.some((i) => i.itemId === id),
  );
  return group?.key ?? null;
}

// Moves an item into a group at a place (past the end means the end), whether
// that group is the one it is in or another
export function moveEntryTo(
  groups: DraftGroup[],
  itemId: string,
  toKey: string,
  index: number,
): DraftGroup[] {
  const entry = groups.flatMap((g) => g.items).find((i) => i.itemId === itemId);
  if (!entry || !groups.some((g) => g.key === toKey)) return groups;
  return removeEntry(groups, itemId).map((g) => {
    if (g.key !== toKey) return g;
    const at = Math.max(0, Math.min(index, g.items.length));
    return {
      ...g,
      items: [...g.items.slice(0, at), entry, ...g.items.slice(at)],
    };
  });
}

// Puts an item where another item in the same group is, as dropping it there
// does: the others shuffle along
export function reorderWithin(
  groups: DraftGroup[],
  itemId: string,
  overItemId: string,
): DraftGroup[] {
  const key = groupKeyOf(groups, itemId);
  if (key === null || key !== groupKeyOf(groups, overItemId)) return groups;
  const items = groups.find((g) => g.key === key)?.items ?? [];
  const to = items.findIndex((i) => i.itemId === overItemId);
  return moveEntryTo(groups, itemId, key, to);
}

// Moves a group one place earlier (-1) or later (1)
export function moveGroup(
  groups: DraftGroup[],
  key: string,
  direction: -1 | 1,
): DraftGroup[] {
  const from = groups.findIndex((g) => g.key === key);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= groups.length) return groups;
  const next = [...groups];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

// Deletes a group. Its items go to the group before it (or after it, for the
// first), so deleting a group never deletes items. The last group stays.
export function deleteGroup(groups: DraftGroup[], key: string): DraftGroup[] {
  const index = groups.findIndex((g) => g.key === key);
  if (index < 0 || groups.length <= 1) return groups;
  const heir = groups[index === 0 ? 1 : index - 1];
  return groups
    .filter((g) => g.key !== key)
    .map((g) =>
      g.key === heir.key
        ? {
            ...g,
            items:
              index === 0
                ? [...groups[index].items, ...g.items]
                : [...g.items, ...groups[index].items],
          }
        : g,
    );
}

export function renameGroup(
  groups: DraftGroup[],
  key: string,
  name: string,
): DraftGroup[] {
  return groups.map((g) => (g.key === key ? { ...g, name } : g));
}

// What is wrong with the groups as they stand, if anything
export function groupsProblem(
  groups: DraftGroup[],
  labeled: boolean,
): string | null {
  if (groups.length < 1 || groups.length > MAX_GROUPS) {
    return `A grouped list has 1 to ${MAX_GROUPS} groups.`;
  }
  if (groupItemCount(groups) < 1) return "Add at least one item first.";
  if (groupItemCount(groups) > MAX_GROUPED_ITEMS) {
    return `A grouped list can hold at most ${MAX_GROUPED_ITEMS} items.`;
  }
  if (labeled) {
    for (const g of groups) {
      const name = g.name.trim();
      if (name.length < 1) return "Every group needs a name.";
      if (name.length > MAX_GROUP_NAME) {
        return `Group names are at most ${MAX_GROUP_NAME} characters.`;
      }
    }
  }
  return null;
}

// The shape set_list_groups takes
export function groupsPayload(
  groups: DraftGroup[],
  labeled: boolean,
): { name: string | null; items: string[] }[] {
  return groups.map((g) => ({
    name: labeled ? g.name.trim() : null,
    items: g.items.map((i) => i.itemId),
  }));
}

// A saved list's groups with their items, for editing. Items without a group
// (added while the feature was off) join the last group.
export function draftGroupsFrom(
  groups: SavedGroup[],
  entries: (GroupEntry & { groupId: string | null })[],
): DraftGroup[] {
  if (groups.length === 0) {
    return [{ ...emptyGroup(), items: entries }];
  }
  const known = new Set(groups.map((g) => g.id));
  const last = groups[groups.length - 1].id;
  return groups.map((g) => ({
    key: g.id,
    name: g.name ?? "",
    items: entries.filter(
      (e) =>
        (e.groupId !== null && known.has(e.groupId) ? e.groupId : last) ===
        g.id,
    ),
  }));
}

// A run of a list's items in one group, as shown on the list page
export type GroupRun<T> = { group: SavedGroup | null; entries: T[] };

// Splits a page of items (in list order) into runs by group. Items without a
// group belong to the last one. With no groups, everything is one run with no
// group, shown plain.
export function groupRuns<T extends { groupId: string | null }>(
  groups: SavedGroup[],
  entries: T[],
): GroupRun<T>[] {
  if (groups.length === 0) return [{ group: null, entries }];
  const byId = new Map(groups.map((g) => [g.id, g]));
  const last = groups[groups.length - 1];
  const runs: GroupRun<T>[] = [];
  for (const entry of entries) {
    const group = (entry.groupId && byId.get(entry.groupId)) || last;
    const current = runs.at(-1);
    if (current && current.group?.id === group.id) current.entries.push(entry);
    else runs.push({ group, entries: [entry] });
  }
  return runs;
}

// "12 items", or for a grouped list "12 items · 3 groups"
export function itemsLabel(items: number, groups: number | null): string {
  const base = `${items} ${items === 1 ? "item" : "items"}`;
  return groups === null
    ? base
    : `${base} · ${groups} ${groups === 1 ? "group" : "groups"}`;
}

// How many groups a list's card should mention: null for a plain list, and for
// a grouped one while grouped lists are turned off (it shows as a plain list)
export function shownGroups(list: {
  grouped?: boolean;
  list_groups?: { count: number }[];
}): number | null {
  return list.grouped && FEATURES.groupedLists
    ? (list.list_groups?.[0]?.count ?? 0)
    : null;
}
