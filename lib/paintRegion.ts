// ABOUTME: Whole-region transforms for the paint editor: flip, rotate and invert the pixels of a selection.
// ABOUTME: Regions are copied pixels, row by row, four bytes each, as `copyRegion` makes them.
import type { Bitmap } from "@/lib/paint";

export type RegionPixels = { pixels: Bitmap; w: number; h: number };

function swap(pixels: Bitmap, a: number, b: number): void {
  for (let k = 0; k < 4; k++) {
    const t = pixels[a + k];
    pixels[a + k] = pixels[b + k];
    pixels[b + k] = t;
  }
}

export function flipRegionHorizontal({ pixels, w, h }: RegionPixels): void {
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < Math.floor(w / 2); col++) {
      swap(pixels, (row * w + col) * 4, (row * w + (w - 1 - col)) * 4);
    }
  }
}

export function flipRegionVertical({ pixels, w, h }: RegionPixels): void {
  for (let row = 0; row < Math.floor(h / 2); row++) {
    for (let col = 0; col < w; col++) {
      swap(pixels, (row * w + col) * 4, ((h - 1 - row) * w + col) * 4);
    }
  }
}

// Turns the pixels a quarter turn. The result is h wide and w high.
export function rotateRegion(
  { pixels, w, h }: RegionPixels,
  clockwise: boolean,
): RegionPixels {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = clockwise ? h - 1 - y : y;
      const ny = clockwise ? x : w - 1 - x;
      const from = (y * w + x) * 4;
      out.set(pixels.subarray(from, from + 4), (ny * h + nx) * 4);
    }
  }
  return { pixels: out, w: h, h: w };
}

export function invertRegion({ pixels }: RegionPixels): void {
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 255 - pixels[i];
    pixels[i + 1] = 255 - pixels[i + 1];
    pixels[i + 2] = 255 - pixels[i + 2];
  }
}
