// ABOUTME: Tests for the time a list card shows, as made or as last added to.
// ABOUTME: Covers rows from queries that leave out the bump columns, which once showed "Now".
import assert from "node:assert/strict";
import { test } from "node:test";
import { listCardTime } from "./listCardTime";

const created_at = "2026-01-01T00:00:00.000Z";
const activity_at = "2026-11-17T10:00:00.000Z";

test("shows when a list was last added to in an activity feed", () => {
  assert.deepEqual(
    listCardTime(
      { created_at, last_bumped_at: activity_at, activity_at },
      true,
    ),
    { bumped: true, time: activity_at },
  );
});

test("shows when a list was made if it was never added to", () => {
  assert.deepEqual(
    listCardTime(
      { created_at, last_bumped_at: null, activity_at: created_at },
      true,
    ),
    { bumped: false, time: created_at },
  );
});

test("shows when a list was made outside an activity feed", () => {
  assert.deepEqual(
    listCardTime(
      { created_at, last_bumped_at: activity_at, activity_at },
      false,
    ),
    { bumped: false, time: created_at },
  );
});

test("shows when a list was made if the bump columns weren't selected", () => {
  assert.deepEqual(listCardTime({ created_at }, true), {
    bumped: false,
    time: created_at,
  });
});
