// ABOUTME: Turns a picture file into a small bitmap in the paint editor's colours.
// ABOUTME: Used by the editor's Open Image and by the Upload button on the compound form.
import { type Bitmap, PALETTE } from "@/lib/craft/paint";
import { fitInside, limitColors } from "@/lib/craft/paintRegion";

// The biggest file that can be uploaded
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
// How much harder the contrast is pushed on pictures that come from outside
const PASTE_CONTRAST = 1.5;

// Shrinks a picture file, keeping its shape, until its longest side is `size`,
// then reduces it to the palette. Gives a message instead when it can't be used.
export async function readPicture(
  file: File,
  size: number,
): Promise<{ pixels: Bitmap; w: number; h: number } | { error: string }> {
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      error: "That file is too big. The most that can be opened is 20 MB.",
    };
  }
  let image: ImageBitmap;
  try {
    image = await createImageBitmap(file);
  } catch {
    return { error: "That isn't a picture that can be opened." };
  }
  const { w, h } = fitInside(image.width, image.height, size);
  const scratch = document.createElement("canvas");
  scratch.width = w;
  scratch.height = h;
  const ctx = scratch.getContext("2d");
  if (!ctx) {
    image.close();
    return { error: "That picture can't be opened in this browser." };
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  // Smoothing averages the pixels being squeezed together, which looks far
  // better than picking one of them
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, w, h);
  image.close();
  const pixels = new Uint8ClampedArray(ctx.getImageData(0, 0, w, h).data);
  limitColors(pixels, PALETTE.flat(), PASTE_CONTRAST);
  return { pixels, w, h };
}
