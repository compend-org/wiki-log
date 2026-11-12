// ABOUTME: Tests for the SFW mode check every list of posts goes through.
// ABOUTME: Only hide mode leaves anything out; unknown modes read as off.
import assert from "node:assert/strict";
import { test } from "node:test";
import { aboutAdultItem, parseSfwMode, shownEntries } from "./sfw";

const posts = [
  { id: "a", items: { nsfw: false } },
  { id: "b", items: { nsfw: true } },
  { id: "c", items: null },
];

test("hide mode leaves out posts about adult items", () => {
  const shown = shownEntries(posts, "hide", aboutAdultItem);
  assert.deepEqual(
    shown.map((p) => p.id),
    ["a", "c"],
  );
});

test("off and blur modes keep every post", () => {
  assert.equal(shownEntries(posts, "off", aboutAdultItem), posts);
  assert.equal(shownEntries(posts, "blur", aboutAdultItem), posts);
});

test("anything but a known mode reads as off", () => {
  assert.equal(parseSfwMode("hide"), "hide");
  assert.equal(parseSfwMode("blur"), "blur");
  assert.equal(parseSfwMode("on"), "off");
  assert.equal(parseSfwMode(undefined), "off");
  assert.equal(parseSfwMode(null), "off");
});
