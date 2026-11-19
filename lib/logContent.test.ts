// ABOUTME: Tests for the rule that a log needs a rating or some review text.
// ABOUTME: Covers each of rating and review alone, both, and neither.
import assert from "node:assert/strict";
import { test } from "node:test";
import { hasLogContent } from "./logContent";

test("a rating alone is enough", () => {
  assert.equal(hasLogContent(3.5, ""), true);
});

test("a review alone is enough", () => {
  assert.equal(hasLogContent(null, "Loved it"), true);
  assert.equal(hasLogContent(0, "Loved it"), true);
});

test("both is enough", () => {
  assert.equal(hasLogContent(4, "Great"), true);
});

test("neither is not enough, and spaces are not a review", () => {
  assert.equal(hasLogContent(null, ""), false);
  assert.equal(hasLogContent(0, ""), false);
  assert.equal(hasLogContent(null, "  \n\t "), false);
});
