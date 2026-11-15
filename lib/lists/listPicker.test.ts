// ABOUTME: Tests for the "Add to list" picker's paging of someone's lists.
// ABOUTME: Covers adding a later page without showing a list twice.
import assert from "node:assert/strict";
import { test } from "node:test";
import { appendLists } from "./listPicker";

const list = (id: string) => ({
  id,
  title: id,
  ranked: false,
  count: 0,
  has: false,
});

test("adds a later page below, leaving out lists already shown", () => {
  assert.deepEqual(
    appendLists([list("a"), list("b")], [list("b"), list("c")]).map(
      (l) => l.id,
    ),
    ["a", "b", "c"],
  );
});
