// ABOUTME: Tests for paging feeds: merging streams and columns, and checking cursors.
// ABOUTME: Covers leftovers, where merged columns may stop, and cursors that aren't valid.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type FeedOrder,
  mergeColumns,
  olderThan,
  parseFeedCursor,
  takeNewest,
} from "./paging";

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

const timed = (id: string, minute: number) => ({
  id,
  order: { score: 0, rank: 0, time: Date.parse(at(minute)) },
});
const ranked = (id: string, score: number, rank: number) => ({
  id,
  order: { score, rank, time: 0 },
});
const ids = (entries: { id: string }[]) => entries.map((e) => e.id);
const timeEnd = (minute: number): FeedOrder => ({
  score: 0,
  rank: 0,
  time: Date.parse(at(minute)),
});

test("merges columns newest first and stops where a column with more stopped", () => {
  const merged = mergeColumns([
    { entries: [timed("r50", 50), timed("r20", 20)], end: timeEnd(20) },
    { entries: [timed("l40", 40), timed("l10", 10)], end: null },
  ]);
  assert.deepEqual(ids(merged), ["r50", "l40", "r20"]);
});

test("a column with more but nothing shown still bounds the merge", () => {
  // Its first page was all empty lists, consumed up to 11:30
  const merged = mergeColumns([
    { entries: [timed("r10", 10)], end: null },
    { entries: [], end: timeEnd(30) },
  ]);
  assert.deepEqual(ids(merged), []);
  // Once it reaches past the review, the review shows and stays
  const later = mergeColumns([
    { entries: [timed("r10", 10)], end: null },
    { entries: [timed("l11", 11)], end: timeEnd(5) },
  ]);
  assert.deepEqual(ids(later), ["l11", "r10"]);
});

test("Trending keeps shown cards when ties in likes run across pages", () => {
  // Thirty-odd posts with the same likes: the ranking's order, not post time
  const first = mergeColumns([
    {
      entries: [ranked("a", 5, 0), ranked("b", 5, 1)],
      end: { score: 5, rank: 1, time: 0 },
    },
    { entries: [], end: null },
  ]);
  const second = mergeColumns([
    {
      entries: [
        ranked("a", 5, 0),
        ranked("b", 5, 1),
        ranked("c", 5, 2),
        ranked("d", 5, 3),
      ],
      end: { score: 5, rank: 3, time: 0 },
    },
    { entries: [], end: null },
  ]);
  assert.deepEqual(ids(first), ["a", "b"]);
  assert.deepEqual(ids(second), ["a", "b", "c", "d"]);
});
