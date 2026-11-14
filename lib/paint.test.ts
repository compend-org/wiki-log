// ABOUTME: Checks the picture editor's drawing code: brushes, lines, shapes, fill and whole-picture changes.
// ABOUTME: Pictures are small enough to compare pixel by pixel.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BLACK,
  blankBitmap,
  brushOffsets,
  drawShape,
  flipHorizontal,
  floodFill,
  getPixel,
  invertColors,
  PAINT_SIZE,
  type Rgb,
  rotate,
  sameBitmap,
  setPixel,
  strokeLine,
  WHITE,
} from "./paint";

const RED: Rgb = [255, 0, 0];

function count(bitmap: Uint8ClampedArray, color: Rgb): number {
  let n = 0;
  for (let i = 0; i < bitmap.length; i += 4) {
    if (
      bitmap[i] === color[0] &&
      bitmap[i + 1] === color[1] &&
      bitmap[i + 2] === color[2]
    ) {
      n++;
    }
  }
  return n;
}

test("a new picture is all white and opaque", () => {
  const bitmap = blankBitmap();
  assert.equal(count(bitmap, WHITE), PAINT_SIZE * PAINT_SIZE);
  assert.equal(bitmap[3], 255);
});

test("drawing outside the picture does nothing", () => {
  const bitmap = blankBitmap();
  setPixel(bitmap, -1, 5, BLACK);
  setPixel(bitmap, 5, PAINT_SIZE, BLACK);
  assert.equal(getPixel(bitmap, -1, 5), null);
  assert.equal(count(bitmap, BLACK), 0);
});

test("brush sizes cover the pixels they say", () => {
  assert.equal(brushOffsets("square", 4).length, 16);
  assert.equal(brushOffsets("circle", 1).length, 1);
  assert.equal(brushOffsets("slash", 5).length, 5);
  assert.ok(brushOffsets("circle", 6).length < 36);
  assert.ok(brushOffsets("circle", 6).length > 20);
});

test("a line joins its two ends without gaps", () => {
  const bitmap = blankBitmap();
  strokeLine(bitmap, 10, 10, 40, 25, brushOffsets("square", 1), BLACK);
  assert.deepEqual(getPixel(bitmap, 10, 10), BLACK);
  assert.deepEqual(getPixel(bitmap, 40, 25), BLACK);
  // One pixel in every column, since it is wider than it is tall
  assert.equal(count(bitmap, BLACK), 31);
});

test("fill stops at a closed outline", () => {
  const bitmap = blankBitmap();
  drawShape(
    bitmap,
    "rectangle",
    { x: 10, y: 10 },
    { x: 30, y: 30 },
    1,
    "outline",
    BLACK,
    WHITE,
  );
  assert.equal(floodFill(bitmap, 20, 20, RED), true);
  // The inside is 19 x 19, and the outside and the outline are untouched
  assert.equal(count(bitmap, RED), 19 * 19);
  assert.deepEqual(getPixel(bitmap, 5, 5), WHITE);
  assert.deepEqual(getPixel(bitmap, 10, 10), BLACK);
});

test("filling with the colour that is already there changes nothing", () => {
  const bitmap = blankBitmap();
  assert.equal(floodFill(bitmap, 3, 3, WHITE), false);
});

test("fill reaches round corners and winding shapes", () => {
  const bitmap = blankBitmap();
  // A wall with a gap at the bottom
  for (let y = 0; y < PAINT_SIZE - 1; y++) setPixel(bitmap, 50, y, BLACK);
  floodFill(bitmap, 10, 10, RED);
  assert.deepEqual(getPixel(bitmap, 90, 10), RED);
  assert.deepEqual(getPixel(bitmap, 90, 99), RED);
  assert.equal(count(bitmap, WHITE), 0);
});

test("a filled rectangle covers its whole box", () => {
  const bitmap = blankBitmap();
  drawShape(
    bitmap,
    "rectangle",
    { x: 30, y: 20 },
    { x: 10, y: 5 },
    1,
    "fill",
    BLACK,
    WHITE,
  );
  assert.equal(count(bitmap, BLACK), 21 * 16);
});

test("an outline with a fill uses both colours inside the box", () => {
  const bitmap = blankBitmap();
  drawShape(
    bitmap,
    "rectangle",
    { x: 10, y: 10 },
    { x: 19, y: 19 },
    2,
    "both",
    BLACK,
    RED,
  );
  assert.equal(count(bitmap, BLACK), 100 - 36);
  assert.equal(count(bitmap, RED), 36);
});

test("an ellipse stays inside its box and is hollow as an outline", () => {
  const bitmap = blankBitmap();
  drawShape(
    bitmap,
    "ellipse",
    { x: 20, y: 30 },
    { x: 60, y: 50 },
    1,
    "outline",
    BLACK,
    WHITE,
  );
  assert.deepEqual(getPixel(bitmap, 40, 40), WHITE);
  assert.deepEqual(getPixel(bitmap, 20, 40), BLACK);
  assert.deepEqual(getPixel(bitmap, 60, 40), BLACK);
  assert.deepEqual(getPixel(bitmap, 19, 40), WHITE);
  assert.deepEqual(getPixel(bitmap, 20, 30), WHITE); // the box's corner
});

test("a rounded rectangle has cut corners but straight sides", () => {
  const bitmap = blankBitmap();
  drawShape(
    bitmap,
    "rounded",
    { x: 10, y: 10 },
    { x: 40, y: 30 },
    1,
    "fill",
    BLACK,
    WHITE,
  );
  assert.deepEqual(getPixel(bitmap, 10, 10), WHITE);
  assert.deepEqual(getPixel(bitmap, 25, 10), BLACK);
  assert.deepEqual(getPixel(bitmap, 10, 20), BLACK);
});

test("flipping twice and rotating four times give the picture back", () => {
  const bitmap = blankBitmap();
  strokeLine(bitmap, 5, 5, 60, 20, brushOffsets("circle", 3), RED);
  const original = bitmap.slice();

  flipHorizontal(bitmap);
  assert.equal(sameBitmap(bitmap, original), false);
  flipHorizontal(bitmap);
  assert.equal(sameBitmap(bitmap, original), true);

  for (let i = 0; i < 4; i++) rotate(bitmap, true);
  assert.equal(sameBitmap(bitmap, original), true);
  rotate(bitmap, true);
  rotate(bitmap, false);
  assert.equal(sameBitmap(bitmap, original), true);
});

test("rotating clockwise moves the top left corner to the top right", () => {
  const bitmap = blankBitmap();
  setPixel(bitmap, 0, 0, RED);
  rotate(bitmap, true);
  assert.deepEqual(getPixel(bitmap, PAINT_SIZE - 1, 0), RED);
});

test("inverting twice gives the picture back", () => {
  const bitmap = blankBitmap();
  setPixel(bitmap, 4, 4, RED);
  const original = bitmap.slice();
  invertColors(bitmap);
  assert.deepEqual(getPixel(bitmap, 4, 4), [0, 255, 255]);
  invertColors(bitmap);
  assert.equal(sameBitmap(bitmap, original), true);
});