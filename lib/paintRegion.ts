// ABOUTME: Whole-region transforms for the paint editor: flip, rotate and invert the pixels of a selection.
// ABOUTME: Regions are copied pixels, row by row, four bytes each, as `copyRegion` makes them.
import type { Bitmap, Rgb } from "@/lib/paint";

// Pushes a colour's brightness away from the middle by `contrast` times
function boost(value: number, contrast: number): number {
  return Math.max(0, Math.min(255, (value - 128) * contrast + 128));
}

// Gives a picture the look of something drawn here: the contrast goes up, then
// every pixel becomes the closest colour of the palette, so there are only flat
// patches of a few colours and hard edges between them
export function limitColors(
  pixels: Bitmap,
  palette: readonly Rgb[],
  contrast: number,
): void {
  for (let i = 0; i < pixels.length; i += 4) {
    const r = boost(pixels[i], contrast);
    const g = boost(pixels[i + 1], contrast);
    const b = boost(pixels[i + 2], contrast);
    let nearest = palette[0];
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const colour of palette) {
      // The eye tells greens apart best and blues worst
      const distance =
        2 * (r - colour[0]) ** 2 +
        4 * (g - colour[1]) ** 2 +
        3 * (b - colour[2]) ** 2;
      if (distance < nearestDistance) {
        nearest = colour;
        nearestDistance = distance;
      }
    }
    pixels[i] = nearest[0];
    pixels[i + 1] = nearest[1];
    pixels[i + 2] = nearest[2];
  }
}

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

export type Placement = { x: number; y: number; w: number; h: number };

// Where a w × h picture goes on a square canvas once it's shrunk (or grown)
// until its longest side is the canvas size, centred along the shorter side
export function fitInside(w: number, h: number, size: number): Placement {
  const scale = size / Math.max(w, h);
  const fittedW = Math.max(1, Math.round(w * scale));
  const fittedH = Math.max(1, Math.round(h * scale));
  return {
    x: Math.floor((size - fittedW) / 2),
    y: Math.floor((size - fittedH) / 2),
    w: fittedW,
    h: fittedH,
  };
}
