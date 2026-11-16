// ABOUTME: Tests for which pictures a review or list entry can choose from, and in what order.
// ABOUTME: Covers the item's own picture coming first, free files only, and each file offered once.
import assert from "node:assert/strict";
import { test } from "node:test";
import { articleFromPageUrl, toChoices } from "./pictureChoices";

const commons = (name: string, width = 960) =>
  `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/${name}/${width}px-${name}`;
const filePage = (name: string) =>
  `https://commons.wikimedia.org/wiki/File:${name}`;
const picture = (name: string, nonFree = false) => ({
  url: commons(name, 330),
  nonFree,
  filePage: filePage(name),
});

test("the item's picture comes first, then the article's in file name order", () => {
  const choices = toChoices(
    { url: commons("Cup.jpg"), filePage: filePage("Cup.jpg") },
    [picture("Machine.jpg"), picture("Beans.jpg")],
    new Set(),
  );
  assert.deepEqual(
    choices.map((c) => [c.url, c.isDefault]),
    [
      [commons("Cup.jpg"), true],
      [commons("Beans.jpg", 330), false],
      [commons("Machine.jpg", 330), false],
    ],
  );
  assert.equal(choices[1].filePage, filePage("Beans.jpg"));
});

test("the item's picture isn't offered again at another size", () => {
  const choices = toChoices(
    { url: commons("Cup.jpg"), filePage: null },
    [picture("Cup.jpg"), picture("Beans.jpg")],
    new Set(),
  );
  assert.deepEqual(
    choices.map((c) => c.url),
    [commons("Cup.jpg"), commons("Beans.jpg", 330)],
  );
});

test("non-free and explicit pictures aren't offered", () => {
  const explicit = picture("Explicit.jpg");
  const choices = toChoices(
    null,
    [picture("Poster.jpg", true), explicit, picture("Beans.jpg")],
    new Set([explicit.url]),
  );
  assert.deepEqual(
    choices.map((c) => c.url),
    [commons("Beans.jpg", 330)],
  );
});

test("an article's language and title are read from its address", () => {
  assert.deepEqual(
    articleFromPageUrl("https://en.wikipedia.org/wiki/Caf%C3%A9_au_lait"),
    { lang: "en", title: "Café_au_lait" },
  );
  assert.deepEqual(articleFromPageUrl("https://de.wikipedia.org/wiki/Kaffee"), {
    lang: "de",
    title: "Kaffee",
  });
  assert.equal(
    articleFromPageUrl("https://xx.wikipedia.org/wiki/Kaffee"),
    null,
  );
  assert.equal(articleFromPageUrl("not an address"), null);
});
