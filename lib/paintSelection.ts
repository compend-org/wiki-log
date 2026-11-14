// ABOUTME: Pixel operations for the paint editor's rectangular selection: copy a region, clear it, paste it back.
// ABOUTME: Regions may hang over the picture's edges; whatever is outside is left out.
import { type Bitmap, PAINT_SIZE, type Rgb } from "@/lib/paint";

export type Region = { x: number; y: number; w: number; h: number };

// A copy of the pixels in a region, row by row. Parts outside the picture come
// out as opaque white, as they would on a blank page.
export function copyRegion(bitmap: Bitmap, region: Region): Bitmap {
  const out = new Uint8ClampedArray(region.w * region.h * 4);
  for (let row = 0; row < region.h; row++) {
    for (let col = 0; col < region.w; col++) {
      const x = region.x + col;
      const y = region.y + row;
      const to = (row * region.w + col) * 4;
      if (x < 0 || y < 0 || x >= PAINT_SIZE || y >= PAINT_SIZE) {
        out.set([255, 255, 255, 255], to);
      } else {
        const from = (y * PAINT_SIZE + x) * 4;
        out.set(bitmap.subarray(from, from + 4), to);
      }
    }
  }
  return out;
}

// Paints a region one colour
export function fillRegion(bitmap: Bitmap, region: Region, color: Rgb): void {
  for (let y = Math.max(0, region.y); y < region.y + region.h; y++) {
    if (y >= PAINT_SIZE) break;
    for (let x = Math.max(0, region.x); x < region.x + region.w; x++) {
      if (x >= PAINT_SIZE) break;
      bitmap.set([color[0], color[1], color[2], 255], (y * PAINT_SIZE + x) * 4);
    }
  }
}

// Lays pixels copied by `copyRegion` onto the picture with their top left
// corner at (x, y). With a `transparent` colour, pixels of that colour leave
// what is underneath showing.
export function pasteRegion(
  bitmap: Bitmap,
  pixels: Bitmap,
  size: { w: number; h: number },
  at: { x: number; y: number },
  transparent: Rgb | null,
): void {
  for (let row = 0; row < size.h; row++) {
    const y = at.y + row;
    if (y < 0 || y >= PAINT_SIZE) continue;
    for (let col = 0; col < size.w; col++) {
      const x = at.x + col;
      if (x < 0 || x >= PAINT_SIZE) continue;
      const from = (row * size.w + col) * 4;
      if (
        transparent &&
        pixels[from] === transparent[0] &&
        pixels[from + 1] === transparent[1] &&
        pixels[from + 2] === transparent[2]
      ) {
        continue;
      }
      bitmap.set(pixels.subarray(from, from + 4), (y * PAINT_SIZE + x) * 4);
    }
  }
}

// The region between two corners, both included, kept inside the picture
export function regionBetween(
  a: { x: number; y: number },
  b: { x: number; y: number },
): Region {
  const clamp = (n: number) => Math.max(0, Math.min(PAINT_SIZE - 1, n));
  const x0 = Math.min(clamp(a.x), clamp(b.x));
  const y0 = Math.min(clamp(a.y), clamp(b.y));
  const x1 = Math.max(clamp(a.x), clamp(b.x));
  const y1 = Math.max(clamp(a.y), clamp(b.y));
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}