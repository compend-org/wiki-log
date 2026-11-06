// ABOUTME: Tests for paging feeds: merging time-ordered streams and checking cursors.
// ABOUTME: Covers what is taken from each stream, leftovers, and cursors that aren't valid.
import assert from "node:assert/strict";
import { test } from "node:test";
import { olderThan, parseFeedCursor, takeNewest } from "./paging";

const at = (minute: number) =>
  `2026-11-05T12:${String(minute).padStart(2, "0")}:00+00:00`;
const row = (minute: number) => ({ at: at(minute) });
const ID = "6f1c1f2e-3b0a-4a51-9b1e-2f6b9c1d0e77";

test("takes the newest across streams and says how many came from each", () => {
  const { taken, hasMore } = takeNewest(
    [
      [row(50), row(40), row(30)],
      [row(45), row(35), row(5)],
    ],
    3,
  );
  assert.deepEqual(taken, [[row(50), row(40)], [row(45)]]);
  assert.equal(hasMore, true);
});

test("has no more when every stream fits", () => {
  const { taken, hasMore } = takeNewest([[row(50)], [], [row(10)]], 3);
  assert.deepEqual(taken, [[row(50)], [], [row(10)]]);
  assert.equal(hasMore, false);
});

test("leaves a stream untouched when the others are all newer", () => {
  const { taken } = takeNewest([[row(50), row(49)], [row(1)]], 2);
  assert.deepEqual(taken[1], []);
});

test("filters for rows after a position, ties broken by id", () => {
  assert.equal(
    olderThan("logged_at", { at: at(30), id: ID }),
    `logged_at.lt."${at(30)}",and(logged_at.eq."${at(30)}",id.lt.${ID})`,
  );
});

test("accepts cursors the feed hands out", () => {
  const cursor = {
    reviews: { posts: { at: at(30), id: ID }, shares: undefined },
    lists: null,
  };
  assert.deepEqual(parseFeedCursor(cursor), {
    reviews: { posts: { at: at(30), id: ID } },
    lists: null,
  });
  assert.deepEqual(parseFeedCursor({ reviews: { rank: 30 }, lists: {} }), {
    reviews: { rank: 30 },
    lists: {},
  });
});

test("turns away cursors that could change the filter", () => {
  const bad = [
    null,
    { reviews: { posts: { at: `${at(30)}),id.gt.(0`, id: ID } }, lists: {} },
    { reviews: { posts: { at: at(30), id: "x,y" } }, lists: {} },
    { reviews: { rank: -1 }, lists: {} },
    { reviews: { rank: 1.5 }, lists: {} },
    { reviews: "all", lists: {} },
  ];
  for (const cursor of bad) assert.equal(parseFeedCursor(cursor), null);
});
