// ABOUTME: Checks, saves and removes the picture someone drew for a compound they are editing.
// ABOUTME: Server only: pictures are PNGs in a public bucket that only our server writes to.
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "compound-images";
const SIZE = 100;
// A 100 x 100 PNG as a data URL is far smaller than this
const MAX_DATA_URL_LENGTH = 120_000;

// The PNG in a drawing sent from the browser, re-encoded by us so nothing else
// can ride along in it, or why it isn't one
export async function readPicture(
  dataUrl: string,
): Promise<{ png: Buffer } | { error: string }> {
  if (dataUrl.length > MAX_DATA_URL_LENGTH)
    return { error: "Picture too big." };
  const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) return { error: "That picture isn't a PNG." };
  try {
    const raw = Buffer.from(match[1], "base64");
    const meta = await sharp(raw).metadata();
    if (meta.format !== "png" || meta.width !== SIZE || meta.height !== SIZE) {
      return { error: `Pictures are ${SIZE} × ${SIZE} pixels.` };
    }
    const png = await sharp(raw)
      .flatten({ background: "#ffffff" })
      .png({ compressionLevel: 9 })
      .toBuffer();
    return { png };
  } catch {
    return { error: "Couldn't read that picture." };
  }
}

// Saves the picture and points the compound at it. The address changes each
// time, so browsers and the CDN don't keep showing the old drawing.
export async function savePicture(
  id: string,
  png: Buffer,
): Promise<string | null> {
  const admin = createAdminClient();
  const path = `${id}.png`;
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, png, { contentType: "image/png", upsert: true });
  if (error) {
    console.error("Saving a compound picture failed:", error.message);
    return null;
  }
  const url = `${admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
  const { error: updateError } = await admin
    .from("items")
    .update({ image_url: url })
    .eq("id", id);
  if (updateError) {
    console.error(
      "Pointing a compound at its picture failed:",
      updateError.message,
    );
    return null;
  }
  return url;
}

// Deletes the stored picture, if there is one
export async function removePicture(id: string): Promise<void> {
  const { error } = await createAdminClient()
    .storage.from(BUCKET)
    .remove([`${id}.png`]);
  if (error)
    console.error("Removing a compound picture failed:", error.message);
}