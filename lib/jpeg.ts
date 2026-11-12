// ABOUTME: Re-encodes a picture as JPEG in the browser, cropped and sized as asked.
// ABOUTME: Re-encoding also drops metadata such as location data stored in photos.

// Draws the `source` part of the picture at `width` x `height` pixels
export async function encodeJpeg(
  bitmap: ImageBitmap,
  source: { x: number; y: number; width: number; height: number },
  width: number,
  height: number,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  ctx.fillStyle = "#111b26"; // behind any transparent areas
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = "high"; // keeps big shrinks from looking jagged
  ctx.drawImage(
    bitmap,
    source.x,
    source.y,
    source.width,
    source.height,
    0,
    0,
    width,
    height,
  );

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Encoding failed"))),
      "image/jpeg",
      0.85,
    ),
  );
}
