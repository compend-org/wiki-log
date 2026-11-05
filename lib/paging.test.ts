// ABOUTME: Tests for the helpers that keep paged feeds in a stable order.
// ABOUTME: Covers reading a snapshot time, rounding it, and ordering rows by rank.
import assert from "node:assert/strict";
import { test } from "node:test";
import { inIdOrder, parseSnapshot, startOfMinute } from "./paging";

test("reads a valid snapshot time in a standard form", () => {
  assert.equal(
    parseSnapshot("2026-11-04T20:35:45.123Z"),
    "2026-11-04T20:35:45.123Z",
  );
  assert.equal(
    parseSnapshot("2026-11-04T20:35:45-08:00"),
    "2026-11-05T04:35:45.000Z",
  );
});

test("ignores a missing or invalid snapshot time", () => {
  assert.equal(parseSnapshot(undefined), undefined);
  assert.equal(parseSnapshot(""), undefined);
  assert.equal(parseSnapshot("not a date"), undefined);
});

test("rounds a snapshot time down to its minute", () => {
  assert.equal(
    startOfMinute("2026-11-04T20:35:45.123Z"),
    "2026-11-04T20:35:00.000Z",
  );
});

test("puts rows in the order of the ids and skips ids with no row", () => {
  const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(inIdOrder(rows, ["c", "gone", "a", "b"]), [
    { id: "c" },
    { id: "a" },
    { id: "b" },
  ]);
});

test("leaves out rows whose id is not listed", () => {
  const rows = [{ id: "a" }, { id: "b" }];
  assert.deepEqual(inIdOrder(rows, ["b"]), [{ id: "b" }]);
});
