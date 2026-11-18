// ABOUTME: Chooses which items of a grouped list a card's preview row shows, so several groups are always visible.
// ABOUTME: Also loads just those items: the first few of each group, found by position.
import type { SupabaseClient } from "@supabase/supabase-js";
import { entryPicture } from "@/lib/format";

// The most slots (thumbnails or "+N" tiles) a preview row can hold
const MAX_PREVIEW_SLOTS = 13;

// A group as the preview knows it: how many items it has, and how many of its
// first ones it has pictures for
export type PreviewGroup = { size: number; available: number };

// What the row shows of one group: its first `shown` items, then a "+N" tile
// for the `more` it leaves out (none when `more` is 0)
export type LayoutGroup = { shown: number; more: number };

export type PreviewLayout = {
  groups: LayoutGroup[];
  // Items in the groups after the last one shown, for a "+N" tile at the end
  rest: number;
};

// Slots a group takes when it shows `shown` of its `size` items: the items,
// and a "+N" tile if it leaves some out
function slots(shown: number, size: number): number {
  return shown < size ? shown + 1 : size;
}

// What to show in `capacity` slots. If everything fits, all of it. Otherwise
// as many groups as can each show something (a group of one or two shows
// whole; a bigger one shows its first item and a "+N"), and the slots left
// over go to the groups in turn, a slot each, so no group takes the row. A
// group never shows all but one of its items, as "+1" would take the room of
// the item itself.
export function previewLayout(
  groups: PreviewGroup[],
  capacity: number,
): PreviewLayout {
  const total = groups.reduce((n, g) => n + g.size, 0);
  if (total <= capacity && groups.every((g) => g.available >= g.size)) {
    return { groups: groups.map((g) => ({ shown: g.size, more: 0 })), rest: 0 };
  }
  if (capacity < 2) {
    return { groups: [{ shown: 1, more: 0 }], rest: 0 };
  }

  // The most groups that can each show something. The "+N" for groups left out
  // takes a slot too, but being able to see several groups matters more: it is
  // given up if it would leave fewer than three groups showing.
  const start = (g: PreviewGroup) =>
    Math.min(g.size <= 2 ? g.size : 1, g.available);
  const fits = (reserve: number) => {
    let n = 0;
    let used = 0;
    for (const g of groups) {
      used += slots(start(g), g.size);
      if (used + (n + 1 < groups.length ? reserve : 0) > capacity) break;
      n += 1;
    }
    return Math.max(1, n);
  };
  const withRest = fits(1);
  const count = withRest >= Math.min(3, groups.length) ? withRest : fits(0);

  const shown = groups.slice(0, count).map(start);
  const groupSlots = shown.reduce((n, s, i) => n + slots(s, groups[i].size), 0);
  // The "+N" for the groups left out, if there is room for it
  const showRest = count < groups.length && groupSlots + 1 <= capacity;
  let left = capacity - groupSlots - (showRest ? 1 : 0);

  // Each group in turn takes one more slot: one more item, or the last two
  // when only they are left
  for (let moved = true; moved && left > 0; ) {
    moved = false;
    for (let i = 0; i < count && left > 0; i++) {
      const { size, available } = groups[i];
      const next =
        shown[i] <= size - 3
          ? shown[i] + 1
          : shown[i] === size - 2
            ? size
            : shown[i];
      if (next === shown[i] || next > available) continue;
      shown[i] = next;
      left -= 1;
      moved = true;
    }
  }

  return {
    groups: shown.map((s, i) => ({ shown: s, more: groups[i].size - s })),
    rest: showRest ? groups.slice(count).reduce((n, g) => n + g.size, 0) : 0,
  };
}

// How many slots fit in a row `width` pixels wide: tiles are 56px with 4px
// between them
export function slotsFor(width: number): number {
  return Math.max(0, Math.min(MAX_PREVIEW_SLOTS, Math.floor((width + 4) / 60)));
}

// The positions of the items to load: the first few of each group, and all of
// a list that is small enough to show whole. Items of a grouped list are
// numbered group by group, so a group starts where the one before ends.
export function wantedPositions(sizes: number[]): number[] {
  const total = sizes.reduce((n, s) => n + s, 0);
  if (total <= MAX_PREVIEW_SLOTS) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  // A group never shows more than this: the row's slots less one for each
  // other group
  const most = Math.max(
    2,
    MAX_PREVIEW_SLOTS - (Math.min(sizes.length, MAX_PREVIEW_SLOTS) - 1),
  );
  const positions: number[] = [];
  let first = 1;
  sizes.forEach((size, g) => {
    if (g < MAX_PREVIEW_SLOTS) {
      for (let i = 0; i < Math.min(size, most); i++) positions.push(first + i);
    }
    first += size;
  });
  return positions;
}

export type GroupPreview = {
  id: string;
  // The group's name; null when the list's groups have none
  name: string | null;
  size: number;
  thumbs: { title: string; image_url: string | null; nsfw: boolean }[];
};

type GroupRow = {
  id: string;
  name: string | null;
  list_items: { count: number }[];
};

type ItemRow = {
  group_id: string | null;
  image_url: string | null;
  items: {
    title: string;
    image_url: string | null;
    image_hidden: boolean;
    nsfw: boolean;
  } | null;
};

// A grouped list's groups, each with its size and its first few items, or
// null if they couldn't be loaded
export async function fetchGroupPreviews(
  supabase: SupabaseClient,
  listId: string,
): Promise<GroupPreview[] | null> {
  const { data: groupRows, error } = await supabase
    .from("list_groups")
    .select("id, name, list_items(count)")
    .eq("list_id", listId)
    .order("position");
  if (error || !groupRows || groupRows.length === 0) return null;
  const groups = (groupRows as unknown as GroupRow[]).map((g) => ({
    id: g.id,
    name: g.name,
    size: g.list_items?.[0]?.count ?? 0,
  }));

  const positions = wantedPositions(groups.map((g) => g.size));
  if (positions.length === 0) return null;
  const { data: itemRows, error: itemsError } = await supabase
    .from("list_items")
    .select("group_id, image_url, items(title, image_url, image_hidden, nsfw)")
    .eq("list_id", listId)
    .in("position", positions)
    .order("position");
  if (itemsError) return null;

  const thumbs = new Map<string, GroupPreview["thumbs"]>();
  for (const row of (itemRows ?? []) as unknown as ItemRow[]) {
    if (!row.group_id) continue;
    const list = thumbs.get(row.group_id) ?? [];
    list.push({
      title: row.items?.title ?? "Unknown item",
      image_url: entryPicture(row),
      nsfw: row.items?.nsfw ?? false,
    });
    thumbs.set(row.group_id, list);
  }
  return groups.map((g) => ({ ...g, thumbs: thumbs.get(g.id) ?? [] }));
}

// The previews of several grouped lists, by list ID. A list whose preview
// couldn't be loaded is left out.
export async function fetchManyGroupPreviews(
  supabase: SupabaseClient,
  listIds: string[],
): Promise<Map<string, GroupPreview[]>> {
  const found = await Promise.all(
    listIds.map(
      async (id) => [id, await fetchGroupPreviews(supabase, id)] as const,
    ),
  );
  const previews = new Map<string, GroupPreview[]>();
  for (const [id, groups] of found) if (groups) previews.set(id, groups);
  return previews;
}
