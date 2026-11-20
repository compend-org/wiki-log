// ABOUTME: Tests for leaving hidden items out of what the viewer sees.
// ABOUTME: Covers posts about hidden items and the thumbnails of lists.
import assert from "node:assert/strict";
import { test } from "node:test";
import { markHidden, withoutHiddenItems } from "./hiddenItems";

const posts = [
  { id: "a", item: "Q1" },
  { id: "b", item: "Q2" },
  { id: "c", item: null },
];

test("leaves out posts about hidden items", () => {
  const shown = withoutHiddenItems(posts, new Set(["Q1"]), (p) => p.item);
  assert.deepEqual(
    shown.map((p) => p.id),
    ["b", "c"],
  );
});

test("keeps every post when nothing is hidden", () => {
  assert.equal(
    withoutHiddenItems(posts, new Set(), (p) => p.item),
    posts,
  );
});

test("marks the thumbnails of hidden items", () => {
  const thumbs = [{ item_id: "Q1" }, { item_id: "Q2" }];
  assert.deepEqual(
    markHidden(thumbs, new Set(["Q2"])).map((t) => t.hidden),
    [false, true],
  );
});
