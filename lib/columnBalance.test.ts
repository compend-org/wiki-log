// ABOUTME: Tests for working out how much of the taller of two columns to show.
// ABOUTME: Covers trimming, columns that have run out, and columns that are not laid out.
import assert from "node:assert/strict";
import { test } from "node:test";
import { findColumnToTrim } from "./columnBalance";

test("trims the taller column to the items that fit beside the shorter one", () => {
  assert.deepEqual(
    findColumnToTrim(
      { itemBottoms: [100, 200, 300], hasMore: true },
      { itemBottoms: [150, 300, 450, 600], hasMore: true },
    ),
    { column: "right", visibleCount: 2 },
  );
});

test("trims the left column when it is the taller one", () => {
  assert.deepEqual(
    findColumnToTrim(
      { itemBottoms: [150, 300, 450, 600], hasMore: true },
      { itemBottoms: [100, 200, 320], hasMore: true },
    ),
    { column: "left", visibleCount: 2 },
  );
});

test("leaves the taller column alone when the shorter one has run out", () => {
  assert.equal(
    findColumnToTrim(
      { itemBottoms: [100, 200, 300], hasMore: true },
      { itemBottoms: [150], hasMore: false },
    ),
    null,
  );
});

test("trims a taller column that has run out while the shorter one has more", () => {
  assert.deepEqual(
    findColumnToTrim(
      { itemBottoms: [100, 200], hasMore: true },
      { itemBottoms: [150, 300], hasMore: false },
    ),
    { column: "right", visibleCount: 1 },
  );
});

test("does nothing when the columns end level", () => {
  assert.equal(
    findColumnToTrim(
      { itemBottoms: [100, 200], hasMore: true },
      { itemBottoms: [200], hasMore: true },
    ),
    null,
  );
});

test("does nothing when the columns are not laid out", () => {
  assert.equal(
    findColumnToTrim(
      { itemBottoms: [0, 0], hasMore: true },
      { itemBottoms: [0, 0, 0], hasMore: true },
    ),
    null,
  );
});
