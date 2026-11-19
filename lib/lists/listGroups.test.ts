// ABOUTME: Tests for the grouped-list helpers: editing draft groups and sorting items into groups.
// ABOUTME: Deleting a group must never lose items, and ungrouped items belong to the last group.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addEntry,
  type DraftGroup,
  deleteGroup,
  draftGroupsFrom,
  groupKeyOf,
  groupRuns,
  groupsPayload,
  groupsProblem,
  itemsLabel,
  moveEntryTo,
  moveGroup,
  notesPayload,
  removeEntry,
  renameGroup,
  reorderWithin,
  setEntryNote,
} from "@/lib/lists/listGroups";

const e = (id: string) => ({ itemId: id, title: id, imageUrl: null });
const g = (key: string, name: string, ...ids: string[]): DraftGroup => ({
  key,
  name,
  items: ids.map(e),
});
const ids = (groups: DraftGroup[]) =>
  groups.map((x) => x.items.map((i) => i.itemId));

test("addEntry puts an item in the chosen group, or the last", () => {
  const groups = [g("a", "A"), g("b", "B")];
  assert.deepEqual(ids(addEntry(groups, e("x"), "a")), [["x"], []]);
  assert.deepEqual(ids(addEntry(groups, e("x"))), [[], ["x"]]);
  assert.deepEqual(ids(addEntry(groups, e("x"), "nope")), [[], ["x"]]);
});

test("addEntry ignores an item that is already in the list", () => {
  const groups = [g("a", "A", "x"), g("b", "B")];
  assert.equal(addEntry(groups, e("x"), "b"), groups);
});

test("moveEntryTo puts an item in a group at a place, in this group or another", () => {
  const groups = [g("a", "A", "1", "2", "3"), g("b", "B", "4")];
  assert.deepEqual(ids(moveEntryTo(groups, "1", "b", 0)), [
    ["2", "3"],
    ["1", "4"],
  ]);
  assert.deepEqual(ids(moveEntryTo(groups, "1", "b", 99)), [
    ["2", "3"],
    ["4", "1"],
  ]);
  assert.deepEqual(ids(moveEntryTo(groups, "1", "a", 2)), [
    ["2", "3", "1"],
    ["4"],
  ]);
  assert.equal(moveEntryTo(groups, "1", "nope", 0), groups);
  assert.equal(moveEntryTo(groups, "zzz", "b", 0), groups);
});

test("moveEntryTo can fill an empty group", () => {
  const groups = [g("a", "A", "1"), g("b", "B")];
  assert.deepEqual(ids(moveEntryTo(groups, "1", "b", 0)), [[], ["1"]]);
});

test("reorderWithin moves an item to another's place in the same group", () => {
  const groups = [g("a", "A", "1", "2", "3"), g("b", "B", "4")];
  assert.deepEqual(ids(reorderWithin(groups, "1", "3")), [
    ["2", "3", "1"],
    ["4"],
  ]);
  assert.deepEqual(ids(reorderWithin(groups, "3", "1")), [
    ["3", "1", "2"],
    ["4"],
  ]);
  assert.equal(reorderWithin(groups, "1", "4"), groups);
});

test("groupKeyOf finds a group by its key or by an item in it", () => {
  const groups = [g("a", "A", "1"), g("b", "B", "2")];
  assert.equal(groupKeyOf(groups, "b"), "b");
  assert.equal(groupKeyOf(groups, "1"), "a");
  assert.equal(groupKeyOf(groups, "x"), null);
});

test("removeEntry removes an item from whichever group has it", () => {
  const groups = [g("a", "A", "1"), g("b", "B", "2")];
  assert.deepEqual(ids(removeEntry(groups, "2")), [["1"], []]);
});

test("moveGroup swaps places and stops at the ends", () => {
  const groups = [g("a", "A"), g("b", "B"), g("c", "C")];
  assert.deepEqual(
    moveGroup(groups, "b", -1).map((x) => x.key),
    ["b", "a", "c"],
  );
  assert.equal(moveGroup(groups, "a", -1), groups);
  assert.equal(moveGroup(groups, "c", 1), groups);
});

test("deleteGroup gives its items to the group before, or after for the first", () => {
  const groups = [g("a", "A", "1"), g("b", "B", "2"), g("c", "C", "3")];
  assert.deepEqual(ids(deleteGroup(groups, "b")), [["1", "2"], ["3"]]);
  assert.deepEqual(ids(deleteGroup(groups, "a")), [["1", "2"], ["3"]]);
  assert.deepEqual(ids(deleteGroup(groups, "c")), [["1"], ["2", "3"]]);
});

test("deleteGroup keeps the last group", () => {
  const groups = [g("a", "A", "1")];
  assert.equal(deleteGroup(groups, "a"), groups);
});

test("renameGroup renames one group", () => {
  const groups = [g("a", "A"), g("b", "B")];
  assert.deepEqual(
    renameGroup(groups, "b", "New").map((x) => x.name),
    ["A", "New"],
  );
});

test("groupsProblem needs names only when the list is labeled", () => {
  const groups = [g("a", "A", "1"), g("b", "  ", "2")];
  assert.equal(groupsProblem(groups, true), "Every group needs a name.");
  assert.equal(groupsProblem(groups, false), null);
});

test("groupsProblem needs an item, and limits groups, items and names", () => {
  assert.match(groupsProblem([g("a", "A")], true) ?? "", /at least one item/);
  assert.match(groupsProblem([], false) ?? "", /1 to 10000 groups/);
  const many = Array.from({ length: 10001 }, (_, i) =>
    g(`k${i}`, "n", `i${i}`),
  );
  assert.match(groupsProblem(many, true) ?? "", /1 to 10000 groups/);
  const items = Array.from({ length: 10001 }, (_, i) => `i${i}`);
  assert.match(groupsProblem([g("a", "A", ...items)], true) ?? "", /10000/);
  assert.match(
    groupsProblem([g("a", "x".repeat(61), "1")], true) ?? "",
    /60 characters/,
  );
});

test("groupsPayload trims names, and drops them when unlabeled", () => {
  const groups = [g("a", " A ", "1", "2"), g("b", "B", "3")];
  assert.deepEqual(groupsPayload(groups, true), [
    { name: "A", items: ["1", "2"] },
    { name: "B", items: ["3"] },
  ]);
  assert.deepEqual(groupsPayload(groups, false), [
    { name: null, items: ["1", "2"] },
    { name: null, items: ["3"] },
  ]);
});

test("draftGroupsFrom puts items without a group in the last group", () => {
  const saved = [
    { id: "g1", name: "A" },
    { id: "g2", name: null },
  ];
  const entries = [
    { ...e("1"), groupId: "g1" },
    { ...e("2"), groupId: null },
    { ...e("3"), groupId: "gone" },
    { ...e("4"), groupId: "g2" },
  ];
  const drafts = draftGroupsFrom(saved, entries);
  assert.deepEqual(ids(drafts), [["1"], ["2", "3", "4"]]);
  assert.deepEqual(
    drafts.map((d) => [d.key, d.name]),
    [
      ["g1", "A"],
      ["g2", ""],
    ],
  );
});

test("draftGroupsFrom makes one group when a list has none", () => {
  const drafts = draftGroupsFrom([], [{ ...e("1"), groupId: null }]);
  assert.deepEqual(ids(drafts), [["1"]]);
});

test("groupRuns splits items into runs by group", () => {
  const saved = [
    { id: "g1", name: "A" },
    { id: "g2", name: "B" },
  ];
  const entries = [
    { itemId: "1", groupId: "g1" },
    { itemId: "2", groupId: "g1" },
    { itemId: "3", groupId: "g2" },
    { itemId: "4", groupId: null },
  ];
  const runs = groupRuns(saved, entries);
  assert.deepEqual(
    runs.map((r) => [r.group?.id, r.entries.map((x) => x.itemId)]),
    [
      ["g1", ["1", "2"]],
      ["g2", ["3", "4"]],
    ],
  );
});

test("groupRuns shows a list with no groups as one plain run", () => {
  const entries = [{ itemId: "1", groupId: null }];
  const runs = groupRuns([], entries);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].group, null);
});

test("itemsLabel adds the group count only for grouped lists", () => {
  assert.equal(itemsLabel(1, null), "1 item");
  assert.equal(itemsLabel(12, null), "12 items");
  assert.equal(itemsLabel(12, 3), "12 items · 3 groups");
  assert.equal(itemsLabel(2, 1), "2 items · 1 group");
});

test("setEntryNote sets and removes one item's note, wherever it is", () => {
  const groups = [g("a", "A", "x"), g("b", "B", "y")];
  const noted = setEntryNote(groups, "y", "why y");
  assert.deepEqual(notesPayload(noted), { y: "why y" });
  assert.equal(groups[1].items[0].note, undefined);
  assert.deepEqual(notesPayload(setEntryNote(noted, "y", null)), {});
});

test("notesPayload leaves out items without a note", () => {
  const groups = [g("a", "A", "x", "y")];
  const noted = setEntryNote(setEntryNote(groups, "x", "one"), "y", null);
  assert.deepEqual(notesPayload(noted), { x: "one" });
});
