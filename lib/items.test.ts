// ABOUTME: Tests for how a Wikipedia lookup becomes an `items` row.
// ABOUTME: An adult flag, once set, survives lookups that find nothing adult (an admin's choice survives any lookup), and a stored image survives a failed image lookup.
import assert from "node:assert/strict";
import { test } from "node:test";
import type { ItemData } from "@/lib/wikipedia/wikipedia";
import { itemColumns, MAX_AGE_MS, shownNsfw } from "./items";

const item: ItemData = {
  id: "Q8398",
  title: "Anal sex",
  description: null,
  imageUrl: null,
  imageNonFree: false,
  imageFilePage: null,
  imageLookupFailed: false,
  pageUrl: "https://en.wikipedia.org/wiki/Anal_sex",
  types: null,
  nsfw: false,
};

test("an adult item is saved flagged", () => {
  assert.equal(itemColumns({ ...item, nsfw: true }).nsfw, true);
});

test("a lookup that finds nothing adult leaves the stored flag alone", () => {
  assert.equal("nsfw" in itemColumns(item), false);
});

test("a refreshed item keeps its saved adult flag", () => {
  assert.equal(shownNsfw(false, { nsfw: true, nsfw_set_at: null }), true);
  assert.equal(shownNsfw(true, { nsfw: false, nsfw_set_at: null }), true);
});

test("a refreshed item shows the adult flag an admin chose, whatever the lookup found", () => {
  const setAt = "2026-11-20T12:00:00Z";
  assert.equal(shownNsfw(true, { nsfw: false, nsfw_set_at: setAt }), false);
  assert.equal(shownNsfw(false, { nsfw: true, nsfw_set_at: setAt }), true);
});

test("an item whose image lookup failed keeps its stored image and is looked up again soon", () => {
  const columns = itemColumns({ ...item, imageLookupFailed: true });
  assert.equal("image_url" in columns, false);
  assert.equal("image_non_free" in columns, false);
  assert.equal("image_page_url" in columns, false);
  assert.ok(new Date(columns.fetched_at).getTime() < Date.now() - MAX_AGE_MS);
});
