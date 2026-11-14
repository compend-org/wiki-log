// ABOUTME: Checks the picture someone drew for a compound and keeps it in the compound-images bucket.
// ABOUTME: It is decoded and written out again here, so only a plain 100 x 100 PNG is ever kept.
import sharp from "sharp";
import { PAINT_SIZE } from "@/lib/paint";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabaseUrl } from "@/lib/supabase/connection";

const BUCKET = "compound-images";
// A drawing this size is a few kilobytes, so this leaves room for a very busy one
const MAX_DATA_URL_LENGTH = 120_000;
const DATA_URL = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/;

const INVALID_PICTURE = "That picture isn't valid.";

// The picture as a clean PNG, or why it can't be used
export async function prepareCompoundImage(
  dataUrl: unknown,
): Promise<{ png: Buffer } | { error: string }> {
  if (typeof dataUrl !== "string" || dataUrl.length > MAX_DATA_URL_LENGTH) {
    return { error: INVALID_PICTURE };
  }
  const match = DATA_URL.exec(dataUrl);
  if (!match) return { error: INVALID_PICTURE };

  try {
    const decoded = sharp(Buffer.from(match[1], "base64"), {
      limitInputPixels: PAINT_SIZE * PAINT_SIZE * 4,
    });
    const meta = await decoded.metadata();
    if (
      meta.format !== "png" ||
      meta.width !== PAINT_SIZE ||
      meta.height !== PAINT_SIZE
    ) {
      return { error: INVALID_PICTURE };
    }
    const png = await decoded
      .flatten({ background: "#ffffff" })
      .png({ compressionLevel: 9 })
      .toBuffer();
    return { png };
  } catch {
    return { error: INVALID_PICTURE };
  }
}

function compoundImageUrl(compoundId: string): string {
  return `${supabaseUrl()}/storage/v1/object/public/${BUCKET}/${compoundId}.png`;
}

// Uploads the picture and points the compound at the given address. A compound
// without its picture is still a compound, so a failure is reported rather
// than thrown.
async function saveImage(
  compoundId: string,
  png: Buffer,
  url: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(`${compoundId}.png`, png, {
      contentType: "image/png",
      cacheControl: "31536000",
      upsert: true,
    });
  if (uploadError) {
    console.error(`Storing the picture of ${compoundId} failed:`, uploadError);
    return false;
  }
  const { error: updateError } = await admin
    .from("items")
    .update({ image_url: url })
    .eq("id", compoundId);
  if (updateError) {
    console.error(`Saving the picture of ${compoundId} failed:`, updateError);
    return false;
  }
  return true;
}

// The first picture of a new compound
export function storeCompoundImage(
  compoundId: string,
  png: Buffer,
): Promise<boolean> {
  return saveImage(compoundId, png, compoundImageUrl(compoundId));
}

// A new picture for a compound that has one. The address changes each time, so
// browsers and the CDN don't keep showing the old drawing. Returns the address.
export async function replaceCompoundImage(
  compoundId: string,
  png: Buffer,
): Promise<string | null> {
  const url = `${compoundImageUrl(compoundId)}?v=${Date.now()}`;
  return (await saveImage(compoundId, png, url)) ? url : null;
}

// Deletes the stored picture, if there is one
export async function removeCompoundImage(compoundId: string): Promise<void> {
  const { error } = await createAdminClient()
    .storage.from(BUCKET)
    .remove([`${compoundId}.png`]);
  if (error) {
    console.error(`Removing the picture of ${compoundId} failed:`, error);
  }
}
