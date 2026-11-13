// ABOUTME: Tests for how a Wikipedia lookup becomes an `items` row.
// ABOUTME: An adult flag, once set, survives lookups that find nothing adult.
import assert from "node:assert/strict";
import { test } from "node:test";
import { itemColumns } from "./items";
import type { ItemData } from "./wikipedia";

const item: ItemData = {
  id: "Q8398",
  title: "Anal sex",
  description: null,
  imageUrl: null,
  imageNonFree: false,
  imageFilePage: null,
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
