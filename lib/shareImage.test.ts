// ABOUTME: Tests for loading pictures into the images people share from the site.
// ABOUTME: Covers large pictures the renderer must still draw, photos stored on their side, and shrinking drawn images.
import assert from "node:assert/strict";
import { test } from "node:test";
import { ImageResponse } from "next/og";
import { createElement } from "react";
import sharp from "sharp";
import { embeddable, smallerPng, stillImage } from "./shareImage";

const dataUrl = (jpeg: Buffer) =>
  `data:image/jpeg;base64,${jpeg.toString("base64")}`;

// Random pixels, the same every run, which no image format can squeeze small
function noise(width: number, height: number): Promise<Buffer> {
  const pixels = Buffer.alloc(width * height * 3);
  let seed = 12345;
  for (let i = 0; i < pixels.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    pixels[i] = seed >>> 24;
  }
  return sharp(pixels, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 75 })
    .toBuffer();
}

test("draws a tall, detailed picture into a share image", async () => {
  const picture = await embeddable(dataUrl(await noise(600, 6000)));
  assert.ok(picture);

  const image = new ImageResponse(
    createElement("img", { src: picture, width: 273, height: 273 }),
    { width: 1080, height: 1350 },
  );
  assert.ok((await image.arrayBuffer()).byteLength > 0);
});

test("turns a photo stored on its side the right way up", async () => {
  // 40 wide and 20 tall as stored, marked to be shown turned a quarter
  const sideways = await sharp({
    create: { width: 40, height: 20, channels: 3, background: "#888888" },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();

  const still = await (await stillImage(dataUrl(sideways))).png().toBuffer();
  const { width, height } = await sharp(still).metadata();
  assert.deepEqual({ width, height }, { width: 20, height: 40 });
});

test("shrinks a drawn image and keeps its size and headers", async () => {
  const picture = await embeddable(dataUrl(await noise(600, 600)));
  const drawn = () =>
    new ImageResponse(
      createElement("img", { src: picture, width: 600, height: 600 }),
      { width: 1080, height: 1350, headers: { "Cache-Control": "no-store" } },
    );
  const original = Buffer.from(await drawn().arrayBuffer());

  const smaller = await smallerPng(drawn());
  const png = Buffer.from(await smaller.arrayBuffer());
  assert.ok(png.byteLength < original.byteLength);
  assert.equal(smaller.headers.get("Content-Type"), "image/png");
  assert.equal(smaller.headers.get("Cache-Control"), "no-store");
  const { width, height, format } = await sharp(png).metadata();
  assert.deepEqual(
    { width, height, format },
    { width: 1080, height: 1350, format: "png" },
  );
});
