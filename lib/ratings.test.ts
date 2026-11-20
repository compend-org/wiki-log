// ABOUTME: Tests for what counts as a rating.
// ABOUTME: Half stars from ½ to 5 or no rating at all; anything else is refused.
import assert from "node:assert/strict";
import { test } from "node:test";
import { isValidRating } from "@/lib/ratings";

test("half stars from ½ to 5 are ratings, and so is no rating", () => {
  for (const rating of [null, 0.5, 1, 3.5, 5]) {
    assert.equal(isValidRating(rating), true, String(rating));
  }
});

test("anything else isn't a rating", () => {
  for (const rating of [0, 5.5, 3.2, -1, Number.NaN, "4", undefined]) {
    assert.equal(isValidRating(rating), false, String(rating));
  }
});
