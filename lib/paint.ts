// ABOUTME: Pixel drawing for the compound picture editor: brushes, lines, shapes and flood fill.
// ABOUTME: Works on a plain RGBA bitmap and uses no browser APIs, so it can be tested on its own.

// Compound pictures are this many pixels wide and tall
export const PAINT_SIZE = 100;

export type Rgb = readonly [number, number, number];

// One byte each of red, green, blue and alpha for every pixel, row by row
export type Bitmap = Uint8ClampedArray<ArrayBuffer>;

function hex(value: string): Rgb {
  const n = Number.parseInt(value.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const BLACK: Rgb = hex("#000000");
export const WHITE: Rgb = hex("#ffffff");

// The 28 colours of the classic palette: dark ones on the top row
export const PALETTE: Rgb[][] = [
  [
    "#000000",
    "#808080",
    "#800000",
    "#808000",
    "#008000",
    "#008080",
    "#000080",
    "#800080",
    "#808040",
    "#004040",
    "#0080ff",
    "#004080",
    "#8000ff",
    "#804000",
  ].map(hex),
  [
    "#ffffff",
    "#c0c0c0",
    "#ff0000",
    "#ffff00",
    "#00ff00",
    "#00ffff",
    "#0000ff",
    "#ff00ff",
    "#ffff80",
    "#00ff80",
    "#80ffff",
    "#8080ff",
    "#ff0080",
    "#ff8040",
  ].map(hex),
];

export function rgbCss([r, g, b]: Rgb): string {
  return `rgb(${r}, ${g}, ${b})`;
}

export function rgbHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function blankBitmap(color: Rgb = WHITE): Bitmap {
  const bitmap: Bitmap = new Uint8ClampedArray(PAINT_SIZE * PAINT_SIZE * 4);
  fillAll(bitmap, color);
  return bitmap;
}

export function fillAll(bitmap: Bitmap, color: Rgb): void {
  for (let i = 0; i < bitmap.length; i += 4) {
    bitmap[i] = color[0];
    bitmap[i + 1] = color[1];
    bitmap[i + 2] = color[2];
    bitmap[i + 3] = 255;
  }
}

export function sameBitmap(a: Bitmap, b: Bitmap): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function inside(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < PAINT_SIZE && y < PAINT_SIZE;
}

export function setPixel(bitmap: Bitmap, x: number, y: number, color: Rgb) {
  if (!inside(x, y)) return;
  const i = (y * PAINT_SIZE + x) * 4;
  bitmap[i] = color[0];
  bitmap[i + 1] = color[1];
  bitmap[i + 2] = color[2];
  bitmap[i + 3] = 255;
}

export function getPixel(bitmap: Bitmap, x: number, y: number): Rgb | null {
  if (!inside(x, y)) return null;
  const i = (y * PAINT_SIZE + x) * 4;
  return [bitmap[i], bitmap[i + 1], bitmap[i + 2]];
}

// Brushes

export type BrushShape = "circle" | "square" | "slash" | "backslash";
export type Offsets = readonly (readonly [number, number])[];

const offsetCache = new Map<string, Offsets>();

// The pixels a brush covers, relative to the pixel it is pointing at
export function brushOffsets(shape: BrushShape, size: number): Offsets {
  const key = `${shape}:${size}`;
  const cached = offsetCache.get(key);
  if (cached) return cached;

  const half = Math.floor(size / 2);
  const out: [number, number][] = [];
  if (shape === "slash" || shape === "backslash") {
    for (let i = 0; i < size; i++) {
      out.push([i - half, shape === "slash" ? half - i : i - half]);
    }
  } else {
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        if (shape === "circle") {
          const cx = dx + 0.5 - size / 2;
          const cy = dy + 0.5 - size / 2;
          // A little under the full circle, so small brushes come out round
          if (cx * cx + cy * cy > (size / 2) ** 2 * 0.85) continue;
        }
        out.push([dx - half, dy - half]);
      }
    }
  }
  offsetCache.set(key, out);
  return out;
}

export function stamp(
  bitmap: Bitmap,
  x: number,
  y: number,
  offsets: Offsets,
  color: Rgb,
) {
  for (const [dx, dy] of offsets) setPixel(bitmap, x + dx, y + dy, color);
}

// Calls `plot` for every pixel on the straight line between two pixels
export function plotLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  plot: (x: number, y: number) => void,
) {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    plot(x, y);
    if (x === x1 && y === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

export function strokeLine(
  bitmap: Bitmap,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  offsets: Offsets,
  color: Rgb,
) {
  plotLine(x0, y0, x1, y1, (x, y) => stamp(bitmap, x, y, offsets, color));
}

// A pen `width` pixels across, for lines and outlines
export function penOffsets(width: number): Offsets {
  return brushOffsets(width <= 2 ? "square" : "circle", width);
}

// A puff of paint: `count` random pixels within `radius` of the centre
export function spray(
  bitmap: Bitmap,
  x: number,
  y: number,
  radius: number,
  count: number,
  color: Rgb,
  random: () => number = Math.random,
) {
  for (let i = 0; i < count; i++) {
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random()) * radius;
    setPixel(
      bitmap,
      Math.round(x + Math.cos(angle) * distance),
      Math.round(y + Math.sin(angle) * distance),
      color,
    );
  }
}

// Fill

// Paints the area of one colour around a pixel. Returns whether it changed.
export function floodFill(
  bitmap: Bitmap,
  x: number,
  y: number,
  color: Rgb,
): boolean {
  if (!inside(x, y)) return false;
  const start = (y * PAINT_SIZE + x) * 4;
  const target = [
    bitmap[start],
    bitmap[start + 1],
    bitmap[start + 2],
    bitmap[start + 3],
  ];
  if (
    target[0] === color[0] &&
    target[1] === color[1] &&
    target[2] === color[2] &&
    target[3] === 255
  ) {
    return false;
  }

  const matches = (px: number, py: number): boolean => {
    const i = (py * PAINT_SIZE + px) * 4;
    return (
      bitmap[i] === target[0] &&
      bitmap[i + 1] === target[1] &&
      bitmap[i + 2] === target[2] &&
      bitmap[i + 3] === target[3]
    );
  };

  const stack: [number, number][] = [[x, y]];
  while (stack.length > 0) {
    const next = stack.pop();
    if (!next) break;
    const [px, py] = next;
    if (!matches(px, py)) continue;
    let left = px;
    let right = px;
    while (left > 0 && matches(left - 1, py)) left--;
    while (right < PAINT_SIZE - 1 && matches(right + 1, py)) right++;
    for (let i = left; i <= right; i++) setPixel(bitmap, i, py, color);
    for (const ny of [py - 1, py + 1]) {
      if (ny < 0 || ny >= PAINT_SIZE) continue;
      let inRun = false;
      for (let i = left; i <= right; i++) {
        if (matches(i, ny)) {
          if (!inRun) stack.push([i, ny]);
          inRun = true;
        } else {
          inRun = false;
        }
      }
    }
  }
  return true;
}

// Shapes

export type ShapeKind = "rectangle" | "ellipse" | "rounded";
// An outline only, an outline with a fill of the other colour, or only a fill
export type FillStyle = "outline" | "both" | "fill";

const CORNER_RADIUS = 5;

// Draws a shape inside the box between two pixels, corners included. The
// outline is `width` pixels thick and sits inside the box.
export function drawShape(
  bitmap: Bitmap,
  kind: ShapeKind,
  from: { x: number; y: number },
  to: { x: number; y: number },
  width: number,
  style: FillStyle,
  stroke: Rgb,
  fill: Rgb,
) {
  const left = Math.min(from.x, to.x);
  const top = Math.min(from.y, to.y);
  const w = Math.abs(from.x - to.x) + 1;
  const h = Math.abs(from.y - to.y) + 1;
  const corner = Math.min(CORNER_RADIUS, w / 2, h / 2);

  // Whether the centre of a pixel is in the shape, shrunk by `inset` all round
  const contains = (px: number, py: number, inset: number): boolean => {
    const x = px + 0.5;
    const y = py + 0.5;
    if (w - 2 * inset <= 0 || h - 2 * inset <= 0) return false;
    if (kind === "rectangle") {
      return (
        x >= left + inset &&
        x <= left + w - inset &&
        y >= top + inset &&
        y <= top + h - inset
      );
    }
    if (kind === "ellipse") {
      const rx = w / 2 - inset;
      const ry = h / 2 - inset;
      const nx = (x - (left + w / 2)) / rx;
      const ny = (y - (top + h / 2)) / ry;
      return nx * nx + ny * ny <= 1;
    }
    const r = Math.max(0, corner - inset);
    const dx = Math.max(left + inset + r - x, 0, x - (left + w - inset - r));
    const dy = Math.max(top + inset + r - y, 0, y - (top + h - inset - r));
    return Math.hypot(dx, dy) <= r;
  };

  for (let y = top; y < top + h; y++) {
    for (let x = left; x < left + w; x++) {
      if (!contains(x, y, 0)) continue;
      if (style === "fill") {
        setPixel(bitmap, x, y, stroke);
      } else if (!contains(x, y, width)) {
        setPixel(bitmap, x, y, stroke);
      } else if (style === "both") {
        setPixel(bitmap, x, y, fill);
      }
    }
  }
}

// Whole-picture changes

export function flipHorizontal(bitmap: Bitmap) {
  const copy = bitmap.slice();
  for (let y = 0; y < PAINT_SIZE; y++) {
    for (let x = 0; x < PAINT_SIZE; x++) {
      const from = (y * PAINT_SIZE + (PAINT_SIZE - 1 - x)) * 4;
      const to = (y * PAINT_SIZE + x) * 4;
      for (let c = 0; c < 4; c++) bitmap[to + c] = copy[from + c];
    }
  }
}

export function flipVertical(bitmap: Bitmap) {
  const copy = bitmap.slice();
  for (let y = 0; y < PAINT_SIZE; y++) {
    for (let x = 0; x < PAINT_SIZE; x++) {
      const from = ((PAINT_SIZE - 1 - y) * PAINT_SIZE + x) * 4;
      const to = (y * PAINT_SIZE + x) * 4;
      for (let c = 0; c < 4; c++) bitmap[to + c] = copy[from + c];
    }
  }
}

export function rotate(bitmap: Bitmap, clockwise: boolean) {
  const copy = bitmap.slice();
  for (let y = 0; y < PAINT_SIZE; y++) {
    for (let x = 0; x < PAINT_SIZE; x++) {
      // Where this pixel of the new picture comes from in the old one
      const fromX = clockwise ? y : PAINT_SIZE - 1 - y;
      const fromY = clockwise ? PAINT_SIZE - 1 - x : x;
      const from = (fromY * PAINT_SIZE + fromX) * 4;
      const to = (y * PAINT_SIZE + x) * 4;
      for (let c = 0; c < 4; c++) bitmap[to + c] = copy[from + c];
    }
  }
}

export function invertColors(bitmap: Bitmap) {
  for (let i = 0; i < bitmap.length; i += 4) {
    bitmap[i] = 255 - bitmap[i];
    bitmap[i + 1] = 255 - bitmap[i + 1];
    bitmap[i + 2] = 255 - bitmap[i + 2];
  }
}
