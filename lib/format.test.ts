// ABOUTME: Tests for the text shown for how long ago something happened.
// ABOUTME: Covers each unit, the boundaries between them, and times just ahead of the clock.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createTranslator } from "next-intl";
import en from "../messages/en.json";
import es from "../messages/es.json";
import {
  entryPicture,
  mentionToken,
  plainItemDescription,
  plainReview,
  REVIEW_LINK,
  reviewPieces,
  shownImage,
  starText,
  thumbUrl,
  timeAgo,
  webAddress,
  webLinkToken,
} from "./format";

const t = createTranslator({ locale: "en", messages: en });
const ago = (time: string, at: number) => timeAgo(time, at, t, "en");

const now = Date.parse("2026-11-05T12:00:00.000Z");
const before = (ms: number) => new Date(now - ms).toISOString();

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

test("shows just now under a minute", () => {
  assert.equal(ago(before(0), now), "Now");
  assert.equal(ago(before(3500), now), "Now");
  assert.equal(ago(before(MINUTE - 1), now), "Now");
});

test("shows whole minutes under an hour", () => {
  assert.equal(ago(before(MINUTE), now), "1m ago");
  assert.equal(ago(before(HOUR - 1), now), "59m ago");
});

test("shows whole hours under a day", () => {
  assert.equal(ago(before(HOUR), now), "1h ago");
  assert.equal(ago(before(DAY - 1), now), "23h ago");
});

test("shows the date from a day ago onwards", () => {
  const time = before(DAY);
  assert.equal(ago(time, now), new Date(time).toLocaleDateString("en"));
});

test("treats a time just ahead of the clock as now", () => {
  assert.equal(ago(before(-500), now), "Now");
});

test("shows an item's image unless it is hidden", () => {
  const url = "https://example.com/a.jpg";
  assert.equal(shownImage({ image_url: url, image_hidden: false }), url);
  assert.equal(shownImage({ image_url: url }), url);
  assert.equal(shownImage({ image_url: url, image_hidden: true }), null);
  assert.equal(shownImage({ image_url: null, image_hidden: false }), null);
});

test("a review shows its chosen picture, or else its item's shown picture", () => {
  const item = "https://example.com/item.jpg";
  const chosen = "https://example.com/chosen.jpg";
  const items = { image_url: item, image_hidden: false };
  assert.equal(entryPicture({ image_url: chosen, items }), chosen);
  assert.equal(entryPicture({ image_url: null, items }), item);
  assert.equal(
    entryPicture({ image_url: null, items: { ...items, image_hidden: true } }),
    null,
  );
  // A hidden item picture doesn't hide the picture the author chose
  assert.equal(
    entryPicture({
      image_url: chosen,
      items: { ...items, image_hidden: true },
    }),
    chosen,
  );
  assert.equal(entryPicture({ image_url: null, items: null }), null);
});

test("thumbnails are asked for only at widths Wikimedia serves", () => {
  const url =
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Neil_Young.jpg/960px-Neil_Young.jpg";
  const thumb = (width: number) =>
    thumbUrl(url, width).replace(/^.*\/(\d+)px-[^/]+$/, "$1");
  assert.equal(thumb(60), "60");
  assert.equal(thumb(80), "120");
  assert.equal(thumb(600), "960");
});

test("shows item links and mentions as plain text", () => {
  const id = "65617370-d22f-4d75-9bf4-456e8caee319";
  const text = `Loved [[Q42|Douglas Adams]], ${mentionToken(id, "Ann Lee")}!`;
  assert.equal(plainReview(text), "Loved Douglas Adams, @Ann Lee!");
});

test("finds each link's id and text", () => {
  const id = "65617370-d22f-4d75-9bf4-456e8caee319";
  const text = `[[Q42|Douglas Adams]] ${mentionToken(id, "Ann")} [[@nope|Bob]]`;
  assert.deepEqual(
    [...text.matchAll(REVIEW_LINK)].map((m) => [m[1], m[2]]),
    [
      ["Q42", "Douglas Adams"],
      [`@${id}`, "Ann"],
    ],
  );
});

test("a rating is written as stars, with a lone half shown beside a star", () => {
  assert.equal(starText(3.5), "★★★½");
  assert.equal(starText(5), "★★★★★");
  assert.equal(starText(0.5), "½★");
  assert.equal(starText(null), "");
});

test("writes the times in the language it is given", () => {
  const spanish = createTranslator({ locale: "es", messages: es });
  assert.equal(timeAgo(before(0), now, spanish, "es"), es.time.now);
  assert.equal(
    timeAgo(before(2 * HOUR), now, spanish, "es"),
    spanish("time.hoursAgo", { hours: 2 }),
  );
});

test("shows markdown as plain text", () => {
  const text = [
    "# Verdict",
    "Took **three hours** to explain why you should *never* go.",
    "> An offer he can't refuse.",
    "- the ~~Fredo~~ cannoli",
    "1. Watch the [4K restoration](https://example.com/godfather), `twice`.",
    "snake_case_names and 2 * 3 * 4 stay as they are",
  ].join("\n");
  assert.equal(
    plainReview(text),
    [
      "Verdict",
      "Took three hours to explain why you should never go.",
      "An offer he can't refuse.",
      "the Fredo cannoli",
      "Watch the 4K restoration, twice.",
      "snake_case_names and 2 * 3 * 4 stay as they are",
    ].join("\n"),
  );
});

test("shows TeX as written, without its $$", () => {
  assert.equal(
    plainReview("Costs $5, or $$\\frac{1}{2}$$ of it.\n$$\nx^2\n$$"),
    "Costs $5, or \\frac{1}{2} of it.\nx^2",
  );
});

test("splits a review into text and its TeX, on its own line when fenced", () => {
  assert.deepEqual(
    reviewPieces(
      "Costs $5, or $$\\frac{1}{2}$$ of **it**.\n$$\nx^2\n$$\nThe end",
    ),
    [
      { text: "Costs $5, or " },
      { tex: "\\frac{1}{2}", display: false },
      { text: " of it." },
      { tex: "x^2", display: true },
      { text: "The end" },
    ],
  );
  assert.deepEqual(reviewPieces("$$x$$"), [{ tex: "x", display: false }]);
  assert.deepEqual(reviewPieces("No math"), [{ text: "No math" }]);
  assert.deepEqual(reviewPieces("$$\\fbox{$x$}$$ and\n$$$\ny\n$$$"), [
    { tex: "\\fbox{$x$}", display: false },
    { text: " and" },
    { tex: "y", display: true },
  ]);
});

test("makes typed web addresses whole", () => {
  assert.equal(webAddress(" example.com/a "), "https://example.com/a");
  assert.equal(webAddress("http://example.com"), "http://example.com");
  assert.equal(webAddress("javascript:alert(1)"), null);
  assert.equal(webAddress("not an address"), null);
  assert.equal(webAddress("hello"), null);
});

test("stores web links that survive brackets and parentheses", () => {
  assert.equal(
    webLinkToken(
      "The [restored]\n cut",
      "https://en.wikipedia.org/wiki/X_(film)",
    ),
    "[The restored cut](https://en.wikipedia.org/wiki/X_%28film%29)",
  );
  assert.equal(
    webLinkToken("  ", "https://example.com"),
    "[https://example.com](https://example.com)",
  );
});

test("drops the markdown from a compound's description only", () => {
  assert.equal(plainItemDescription("C12", "Tastes **loud**"), "Tastes loud");
  assert.equal(plainItemDescription("Q42", "1 * 2 * 3"), "1 * 2 * 3");
});
