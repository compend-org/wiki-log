// ABOUTME: Tests for choosing which items of a grouped list a card's preview shows.
// ABOUTME: Several groups must stay visible however big the first one is.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  previewLayout,
  slotsFor,
  tileSize,
  wantedPositions,
} from "@/lib/lists/groupPreview";

const groups = (...sizes: number[]) =>
  sizes.map((size) => ({ size, available: size }));

test("a list that fits is shown whole", () => {
  assert.deepEqual(previewLayout(groups(2, 1), 5), {
    groups: [
      { shown: 2, more: 0 },
      { shown: 1, more: 0 },
    ],
    rest: 0,
  });
});

test("big groups show their first item and a +N, each group visible", () => {
  assert.deepEqual(previewLayout(groups(4, 2, 5), 6), {
    groups: [
      { shown: 1, more: 3 },
      { shown: 2, more: 0 },
      { shown: 1, more: 4 },
    ],
    rest: 0,
  });
});

test("spare slots go to the groups in turn", () => {
  assert.deepEqual(previewLayout(groups(4, 2, 5), 7).groups, [
    { shown: 2, more: 2 },
    { shown: 2, more: 0 },
    { shown: 1, more: 4 },
  ]);
});

test("a huge first group does not take the row", () => {
  assert.deepEqual(previewLayout(groups(20, 3, 3), 8).groups, [
    { shown: 2, more: 18 },
    { shown: 3, more: 0 },
    { shown: 1, more: 2 },
  ]);
});

test("groups that don't fit are counted in a +N at the end", () => {
  assert.deepEqual(previewLayout(groups(3, 3, 3, 3, 3, 3), 9), {
    groups: [
      { shown: 1, more: 2 },
      { shown: 1, more: 2 },
      { shown: 1, more: 2 },
      { shown: 1, more: 2 },
    ],
    rest: 6,
  });
});

test("seeing several groups beats the +N for the ones left out", () => {
  assert.deepEqual(previewLayout(groups(3, 3, 3, 3), 6), {
    groups: [
      { shown: 1, more: 2 },
      { shown: 1, more: 2 },
      { shown: 1, more: 2 },
    ],
    rest: 0,
  });
  // Two groups still show in a row too small for a +N after them
  assert.deepEqual(previewLayout(groups(6, 6, 6, 6, 6), 4).groups, [
    { shown: 1, more: 5 },
    { shown: 1, more: 5 },
  ]);
});

test("a single group takes the whole row, less its +N", () => {
  assert.deepEqual(previewLayout(groups(10), 6).groups, [
    { shown: 5, more: 5 },
  ]);
});

test("a group never shows all but one of its items", () => {
  for (let capacity = 2; capacity <= 13; capacity++) {
    for (const g of previewLayout(groups(9, 4, 7), capacity).groups) {
      assert.notEqual(g.more, 1);
    }
  }
});

test("the layout never uses more slots than there are", () => {
  for (let capacity = 2; capacity <= 13; capacity++) {
    for (const sizes of [
      [9, 4, 7],
      [1, 1, 1, 1, 1, 1],
      [30, 30],
      [2, 40, 2, 2],
    ]) {
      const layout = previewLayout(groups(...sizes), capacity);
      const used =
        layout.groups.reduce((n, g) => n + g.shown + (g.more > 0 ? 1 : 0), 0) +
        (layout.rest > 0 ? 1 : 0);
      assert.ok(used <= capacity, `${sizes} in ${capacity} used ${used}`);
    }
  }
});

test("only pictures it has are shown", () => {
  const layout = previewLayout(
    [
      { size: 10, available: 3 },
      { size: 10, available: 3 },
    ],
    13,
  );
  assert.deepEqual(layout.groups, [
    { shown: 3, more: 7 },
    { shown: 3, more: 7 },
  ]);
});

test("a row too narrow for a +N shows just the first item", () => {
  assert.deepEqual(previewLayout(groups(5, 5), 1).groups, [
    { shown: 1, more: 0 },
  ]);
});

test("slotsFor counts tiles of at least 52px with 4px between them", () => {
  assert.equal(slotsFor(52), 1);
  assert.equal(slotsFor(108), 2);
  assert.equal(slotsFor(107), 1);
  // nine tiles of about 55px fit in a row that holds eight whole ones
  assert.equal(slotsFor(528), 9);
  assert.equal(slotsFor(5000), 13);
  assert.equal(slotsFor(0), 0);
});

test("tileSize shrinks tiles only as far as it takes to fit the slots", () => {
  assert.equal(tileSize(5000, 13), 56);
  assert.equal(tileSize(536, 9), 56);
  assert.ok(Math.abs(tileSize(528, 9) - 55.11) < 0.01);
  assert.equal(tileSize(108, 2), 52);
  assert.equal(tileSize(0, 0), 56);
});

test("a small list loads every item", () => {
  assert.deepEqual(wantedPositions([3, 2]), [1, 2, 3, 4, 5]);
});

test("a big list loads the first few of each group, by position", () => {
  const positions = wantedPositions([20, 3, 30]);
  assert.deepEqual(positions.slice(0, 3), [1, 2, 3]);
  assert.ok(positions.includes(21) && positions.includes(23));
  assert.ok(positions.includes(24));
  assert.ok(!positions.includes(2 + 20 + 3 + 12));
});
