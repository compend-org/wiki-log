// ABOUTME: Tests for placing pinned posts and lists in the Trending ranking.
// ABOUTME: Checks the place, kinds counting together, a short ranking and a pin that is already ranked.
import assert from "node:assert/strict";
import { test } from "node:test";
import { pinPosts, type RankedRow } from "./trendingPins";

const row = (id: string, n: number): RankedRow => ({
  row_id: id,
  recent_likes: n,
});

// The order Trending shows: score, then rank within its kind
function shown(logs: RankedRow[], lists: RankedRow[]) {
  return [
    ...logs.map((r, i) => ({ ...r, i })),
    ...lists.map((r, i) => ({ ...r, i })),
  ]
    .sort(
      (a, b) => Number(b.recent_likes) - Number(a.recent_likes) || a.i - b.i,
    )
    .map((r) => r.row_id);
}

const listPin = (id: string, position: number) => ({
  log_id: null,
  list_id: id,
  position,
});

test("a pinned list lands at its place among posts and lists together", () => {
  const logs = [row("a", 9), row("b", 7), row("c", 5)];
  const lists = [row("x", 8), row("y", 6)];
  const out = pinPosts(logs, lists, [listPin("p", 3)]);
  assert.deepEqual(shown(out.logs, out.lists).slice(0, 5), [
    "a",
    "x",
    "p",
    "b",
    "y",
  ]);
});

test("a pinned post lands the same way", () => {
  const logs = [row("a", 9), row("b", 7)];
  const lists = [row("x", 8)];
  const out = pinPosts(logs, lists, [
    { log_id: "p", list_id: null, position: 2 },
  ]);
  assert.deepEqual(shown(out.logs, out.lists), ["a", "p", "x", "b"]);
});

test("a pin on a short ranking goes last", () => {
  const out = pinPosts([row("a", 4)], [], [listPin("p", 3)]);
  assert.deepEqual(shown(out.logs, out.lists), ["a", "p"]);
});

test("a pin for a list that is already ranked moves it", () => {
  const lists = [row("a", 9), row("b", 7), row("p", 1)];
  const out = pinPosts([], lists, [listPin("p", 1)]);
  assert.deepEqual(shown(out.logs, out.lists), ["p", "a", "b"]);
});

test("no pins leaves the ranking alone", () => {
  const logs = [row("a", 9)];
  const lists = [row("x", 1)];
  const out = pinPosts(logs, lists, []);
  assert.equal(out.logs, logs);
  assert.equal(out.lists, lists);
});
