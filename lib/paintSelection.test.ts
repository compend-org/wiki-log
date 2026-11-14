// ABOUTME: Tests for the paint editor's selection operations.
// ABOUTME: Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { blankBitmap, PAINT_SIZE } from "./paint";
import {
  copyRegion,
  fillRegion,
  pasteRegion,
  regionBetween,
} from "./paintSelection";

const at = (b: Uint8ClampedArray, x: number, y: number) =>
  Array.from(
    b.subarray((y * PAINT_SIZE + x) * 4, (y * PAINT_SIZE + x) * 4 + 4),
  );

test("copies what is inside a region", () => {
  const b = blankBitmap();
  fillRegion(b, { x: 2, y: 3, w: 2, h: 2 }, [10, 20, 30]);
  const copy = copyRegion(b, { x: 2, y: 3, w: 2, h: 2 });
  assert.equal(copy.length, 16);
  assert.deepEqual(Array.from(copy.subarray(0, 4)), [10, 20, 30, 255]);
  assert.deepEqual(Array.from(copy.subarray(12, 16)), [10, 20, 30, 255]);
});

test("copies the parts outside the picture as white", () => {
  const copy = copyRegion(blankBitmap(), { x: -1, y: 0, w: 2, h: 1 });
  assert.deepEqual(Array.from(copy.subarray(0, 4)), [255, 255, 255, 255]);
});

test("fills only inside the picture", () => {
  const b = blankBitmap();
  fillRegion(
    b,
    { x: PAINT_SIZE - 1, y: PAINT_SIZE - 1, w: 5, h: 5 },
    [1, 2, 3],
  );
  assert.deepEqual(at(b, PAINT_SIZE - 1, PAINT_SIZE - 1), [1, 2, 3, 255]);
});

test("pastes pixels where asked, clipped to the picture", () => {
  const b = blankBitmap();
  const pixels = new Uint8ClampedArray(2 * 2 * 4).fill(200);
  pasteRegion(b, pixels, { w: 2, h: 2 }, { x: PAINT_SIZE - 1, y: 0 }, null);
  assert.deepEqual(at(b, PAINT_SIZE - 1, 0), [200, 200, 200, 200]);
  assert.deepEqual(at(b, PAINT_SIZE - 1, 1), [200, 200, 200, 200]);
});

test("transparent pastes leave what is underneath showing", () => {
  const b = blankBitmap();
  fillRegion(b, { x: 0, y: 0, w: 2, h: 1 }, [9, 9, 9]);
  const pixels = new Uint8ClampedArray([255, 255, 255, 255, 5, 6, 7, 255]);
  pasteRegion(b, pixels, { w: 2, h: 1 }, { x: 0, y: 0 }, [255, 255, 255]);
  assert.deepEqual(at(b, 0, 0), [9, 9, 9, 255]);
  assert.deepEqual(at(b, 1, 0), [5, 6, 7, 255]);
});

test("a region between two corners includes both, in any order", () => {
  assert.deepEqual(regionBetween({ x: 5, y: 7 }, { x: 2, y: 3 }), {
    x: 2,
    y: 3,
    w: 4,
    h: 5,
  });
  assert.deepEqual(regionBetween({ x: -4, y: 0 }, { x: 500, y: 0 }), {
    x: 0,
    y: 0,
    w: PAINT_SIZE,
    h: 1,
  });
});
