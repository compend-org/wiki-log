// ABOUTME: What the viewer sees of items they have hidden: posts about them are left out,
// ABOUTME: and their thumbnails in lists show as blank tiles.

// The entries that aren't about an item the viewer has hidden
export function withoutHiddenItems<T>(
  entries: T[],
  hidden: Set<string>,
  itemOf: (entry: T) => string | null | undefined,
): T[] {
  if (hidden.size === 0) return entries;
  return entries.filter((e) => {
    const itemId = itemOf(e);
    return !itemId || !hidden.has(itemId);
  });
}

// Thumbnails, with those of hidden items marked to show as blank tiles
export function markHidden<T extends { item_id: string }>(
  thumbs: T[],
  hidden: Set<string>,
): (T & { hidden: boolean })[] {
  return thumbs.map((t) => ({ ...t, hidden: hidden.has(t.item_id) }));
}

// A grouped list's groups, with the thumbnails of hidden items marked, or null
// when there are none
export function markHiddenInGroups<G extends { thumbs: { item_id: string }[] }>(
  groups: G[] | null | undefined,
  hidden: Set<string>,
): G[] | null {
  return groups
    ? groups.map((g) => ({ ...g, thumbs: markHidden(g.thumbs, hidden) }))
    : null;
}
