// ABOUTME: Tests for the text shown for how long ago something happened.
// ABOUTME: Covers each unit, the boundaries between them, and times just ahead of the clock.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createTranslator } from "next-intl";
import en from "../messages/en.json";
import es from "../messages/es.json";
import {
  entryPicture,
  leadingMentionId,
  mentionToken,
  plainReview,
  REVIEW_LINK,
  shownImage,
  starText,
  thumbUrl,
  timeAgo,
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

test("finds who a comment answers from the mention it opens with", () => {
  const id = "65617370-d22f-4d75-9bf4-456e8caee319";
  assert.equal(leadingMentionId(`${mentionToken(id, "sandy")} yeah`), id);
  assert.equal(leadingMentionId(`yeah ${mentionToken(id, "sandy")}`), null);
  assert.equal(leadingMentionId("[[Q42|Douglas Adams]] is great"), null);
  assert.equal(leadingMentionId("just text"), null);
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
