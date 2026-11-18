// ABOUTME: Tests for the few words that say why a person is suggested.
// ABOUTME: Covers each reason, the items it names, and picking a few people at random.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type SuggestedPerson,
  sample,
  shortTitle,
  suggestionParts,
  suggestionsDismissed,
} from "./suggestedPeople";

const person = (over: Partial<SuggestedPerson>): SuggestedPerson => ({
  id: "a",
  username: "ann",
  avatar_path: null,
  recent_logs: 4,
  followers: 10,
  reason: "active",
  overlap: 0,
  mutuals: 0,
  mutual_name: null,
  featured: [],
  ...over,
});

const banana = { id: "q1", title: "Banana" };
const potato = { id: "q2", title: "Potato" };

// The text of a line, with items written as [title]
const flat = (p: SuggestedPerson) =>
  suggestionParts(p)
    .map((part) => (typeof part === "string" ? part : `[${part.title}]`))
    .join("");

test("says when they follow you", () => {
  assert.equal(flat(person({ reason: "follows_you" })), "Follows you");
});

test("names the one person you follow who follows them", () => {
  assert.equal(
    flat(person({ reason: "mutuals", mutuals: 1, mutual_name: "bo" })),
    "Followed by bo, who you follow",
  );
});

test("counts the others when several people you follow follow them", () => {
  const reason = (mutuals: number) =>
    flat(person({ reason: "mutuals", mutuals, mutual_name: "bo" }));
  assert.equal(reason(2), "Followed by bo and 1 other you follow");
  assert.equal(reason(4), "Followed by bo and 3 others you follow");
});

test("names the things you have both logged", () => {
  const reason = (overlap: number, featured = [banana, potato]) =>
    flat(person({ reason: "overlap", overlap, featured }));
  assert.equal(reason(2), "You both logged [Banana] and [Potato]");
  assert.equal(reason(1, [banana]), "You both logged [Banana]");
  assert.equal(reason(5), "You both logged [Banana], [Potato] and 3 more");
});

test("counts shared things when none can be named", () => {
  const reason = (overlap: number) =>
    flat(person({ reason: "overlap", overlap, featured: [] }));
  assert.equal(reason(1), "Logged something you've logged");
  assert.equal(reason(3), "Logged 3 things you've logged");
});

test("says how much they logged this week, and what got noticed", () => {
  assert.equal(
    flat(person({ recent_logs: 900, featured: [potato, banana] })),
    "900 logs this week, including [Potato] and [Banana]",
  );
  assert.equal(flat(person({ recent_logs: 1 })), "1 log this week");
  assert.equal(flat(person({ recent_logs: 9 })), "9 logs this week");
});

test("a long title is cut short", () => {
  assert.equal(shortTitle("Banana"), "Banana");
  const cut = shortTitle("The Hitchhiker's Guide to the Galaxy (novel)");
  assert.ok(cut.endsWith("…"));
  assert.ok(cut.length <= 40);
});

test("sample takes the number asked for, without repeats", () => {
  const picked = sample([1, 2, 3, 4, 5, 6, 7, 8], 5);
  assert.equal(picked.length, 5);
  assert.equal(new Set(picked).size, 5);
});

test("sample gives everything when there are fewer than asked for", () => {
  assert.deepEqual(sample([1, 2], 5).sort(), [1, 2]);
  assert.deepEqual(sample([], 3), []);
});

test("sample follows the random numbers it is given", () => {
  assert.deepEqual(
    sample([10, 20, 30, 40], 2, () => 0),
    [10, 20],
  );
  assert.deepEqual(
    sample([10, 20, 30, 40], 2, () => 0.99),
    [40, 30],
  );
});

test("the box stays dismissed for a month, then comes back", () => {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.parse("2026-12-01T12:00:00Z");
  const ago = (days: number) => new Date(now - days * day).toISOString();
  assert.equal(suggestionsDismissed(null, now), false);
  assert.equal(suggestionsDismissed(undefined, now), false);
  assert.equal(suggestionsDismissed(ago(1), now), true);
  assert.equal(suggestionsDismissed(ago(29), now), true);
  assert.equal(suggestionsDismissed(ago(31), now), false);
});
