// ABOUTME: Tests for carrying a half-made list between the plain and grouped list editors.
// ABOUTME: Nothing is lost either way: a plain list goes into one group, groups are flattened in order.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EMPTY_DRAFT,
  flattenGroups,
  groupsFromDraft,
  keptPictures,
} from "@/lib/lists/creatorDraft";
import type { DraftGroup } from "@/lib/lists/listGroups";

const item = (id: string, note: string | null = null) => ({
  itemId: id,
  title: id,
  imageUrl: null,
  note,
});

test("a plain list's items all go in the first group, notes kept", () => {
  const groups = groupsFromDraft({
    ...EMPTY_DRAFT,
    items: [item("a", "why a"), item("b"), item("c")],
  });
  assert.equal(groups.length, 1);
  assert.deepEqual(
    groups[0].items.map((i) => [i.itemId, i.note]),
    [
      ["a", "why a"],
      ["b", null],
      ["c", null],
    ],
  );
});

test("a plain list with no items makes no groups for the editor to fill", () => {
  assert.deepEqual(groupsFromDraft(EMPTY_DRAFT), []);
});

test("groups are flattened in order, notes kept, a missing note as null", () => {
  const groups: DraftGroup[] = [
    { key: "1", name: "One", items: [{ ...item("a"), note: undefined }] },
    { key: "2", name: "Two", items: [item("b", "why b"), item("c")] },
    { key: "3", name: "Empty", items: [] },
  ];
  assert.deepEqual(
    flattenGroups(groups).map((i) => [i.itemId, i.note]),
    [
      ["a", null],
      ["b", "why b"],
      ["c", null],
    ],
  );
});

test("going to groups and back keeps the items in their order", () => {
  const items = [item("a", "x"), item("b"), item("c", "z")];
  assert.deepEqual(
    flattenGroups(groupsFromDraft({ ...EMPTY_DRAFT, items })),
    items,
  );
});

test("keptPictures drops the pictures that were taken back", () => {
  assert.deepEqual(keptPictures({ a: "https://x/a.png", b: null }), {
    a: "https://x/a.png",
  });
});
