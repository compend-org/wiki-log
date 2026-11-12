// ABOUTME: Tests for deciding whether a post with images is removed, from moderation scores.
// ABOUTME: Covers thresholds, combining several images and GIF frames, and the report's wording.
import assert from "node:assert/strict";
import { test } from "node:test";
import { framesToCheck, imageVerdict, verdictDetails } from "./imageModeration";

test("keeps images that score low everywhere", () => {
  const verdict = imageVerdict([{ sexual: 0.01, violence: 0.001 }]);
  assert.deepEqual(verdict.over, []);
  assert.equal(verdict.reason, null);
});

test("keeps an ordinary injury photo that OpenAI itself would flag", () => {
  // Real scores for a photo of a cut leg
  const verdict = imageVerdict([
    { violence: 0.609, "violence/graphic": 0.108, sexual: 0.003 },
  ]);
  assert.equal(verdict.reason, null);
});

test("removes sexual images, reported as sexual", () => {
  const verdict = imageVerdict([{ sexual: 0.93, violence: 0.85 }]);
  assert.deepEqual(verdict.over, ["sexual", "violence"]);
  assert.equal(verdict.reason, "sexual");
});

test("removes graphic violence and self-harm, reported as other", () => {
  assert.equal(imageVerdict([{ "violence/graphic": 0.5 }]).reason, "other");
  assert.equal(imageVerdict([{ "self-harm/intent": 0.7 }]).reason, "other");
});

test("ignores categories OpenAI only scores for text", () => {
  const verdict = imageVerdict([{ hate: 0.99, harassment: 0.99 }]);
  assert.equal(verdict.reason, null);
});

test("one bad image or GIF frame is enough", () => {
  const verdict = imageVerdict([
    { sexual: 0.01, violence: 0.01 },
    { sexual: 0.02, violence: 0.95 },
    { sexual: 0.01, violence: 0.02 },
  ]);
  assert.deepEqual(verdict.over, ["violence"]);
  assert.deepEqual(verdict.maxScores, { sexual: 0.02, violence: 0.95 });
});

test("has nothing to say about no images", () => {
  assert.deepEqual(imageVerdict([]), { maxScores: {}, over: [], reason: null });
});

test("tells moderators which categories were over, with their scores", () => {
  const verdict = imageVerdict([{ sexual: 0.931, violence: 0.856 }]);
  assert.equal(
    verdictDetails(verdict),
    "Removed by the automatic image check: sexual 0.93, violence 0.86",
  );
});

test("checks a still image or one-frame GIF once", () => {
  assert.deepEqual(framesToCheck(1), [0]);
  assert.deepEqual(framesToCheck(0), [0]);
});

test("checks every frame of short GIFs", () => {
  assert.deepEqual(framesToCheck(3), [0, 1, 2]);
});

test("spreads checks over long GIFs, including the first and last frames", () => {
  assert.deepEqual(framesToCheck(4), [0, 1, 2, 3]);
  assert.deepEqual(framesToCheck(100), [0, 33, 66, 99]);
});
