// ABOUTME: Tests for placing pinned posts in the Trending ranking.
// ABOUTME: Checks the place, lists counting, a short ranking and a pin that is already ranked.
import assert from "node:assert/strict";
import { test } from "node:test";
import { pinLogs, type RankedRow } from "./trendingPins";

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

test("a pin lands at its place among logs and lists together", () => {
  const logs = [row("a", 9), row("b", 7), row("c", 5)];
  const lists = [row("x", 8), row("y", 6)];
  const out = pinLogs(logs, lists, [{ log_id: "p", position: 3 }]);
  assert.deepEqual(shown(out, lists).slice(0, 5), ["a", "x", "p", "b", "y"]);
});

test("a pin on a short ranking goes last", () => {
  const out = pinLogs([row("a", 4)], [], [{ log_id: "p", position: 3 }]);
  assert.deepEqual(shown(out, []), ["a", "p"]);
});

test("a pin for a post that is already ranked moves it", () => {
  const logs = [row("a", 9), row("b", 7), row("p", 1)];
  const out = pinLogs(logs, [], [{ log_id: "p", position: 1 }]);
  assert.deepEqual(shown(out, []), ["p", "a", "b"]);
});

test("no pins leaves the ranking alone", () => {
  const logs = [row("a", 9)];
  assert.equal(pinLogs(logs, [], []), logs);
});
