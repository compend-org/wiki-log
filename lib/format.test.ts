// ABOUTME: Tests for the text shown for how long ago something happened.
// ABOUTME: Covers each unit, the boundaries between them, and times just ahead of the clock.
import assert from "node:assert/strict";
import { test } from "node:test";
import { shownImage, timeAgo } from "./format";

const now = Date.parse("2026-11-05T12:00:00.000Z");
const before = (ms: number) => new Date(now - ms).toISOString();

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

test("shows just now under a minute", () => {
  assert.equal(timeAgo(before(0), now), "Now");
  assert.equal(timeAgo(before(3500), now), "Now");
  assert.equal(timeAgo(before(MINUTE - 1), now), "Now");
});

test("shows whole minutes under an hour", () => {
  assert.equal(timeAgo(before(MINUTE), now), "1m ago");
  assert.equal(timeAgo(before(HOUR - 1), now), "59m ago");
});

test("shows whole hours under a day", () => {
  assert.equal(timeAgo(before(HOUR), now), "1h ago");
  assert.equal(timeAgo(before(DAY - 1), now), "23h ago");
});

test("shows the date from a day ago onwards", () => {
  const time = before(DAY);
  assert.equal(timeAgo(time, now), new Date(time).toLocaleDateString());
});

test("treats a time just ahead of the clock as now", () => {
  assert.equal(timeAgo(before(-500), now), "Now");
});

test("shows an item's image unless it is hidden", () => {
  const url = "https://example.com/a.jpg";
  assert.equal(shownImage({ image_url: url, image_hidden: false }), url);
  assert.equal(shownImage({ image_url: url }), url);
  assert.equal(shownImage({ image_url: url, image_hidden: true }), null);
  assert.equal(shownImage({ image_url: null, image_hidden: false }), null);
});
