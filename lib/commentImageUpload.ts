// ABOUTME: Prepares and uploads, from the browser, the image someone attaches to a comment.
// ABOUTME: Photos are shrunk and re-encoded as JPEG; GIFs go up unchanged so they keep moving.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  COMMENT_IMAGE_MAX_SIDE,
  COMMENT_IMAGES_BUCKET,
  commentImagePath,
  fitWithin,
} from "@/lib/commentImages";
import { encodeJpeg } from "@/lib/jpeg";

type PreparedImage = { path: string; blob: Blob; contentType: string };

async function prepare(file: File, userId: string): Promise<PreparedImage> {
  if (file.type === "image/gif") {
    return {
      path: commentImagePath(userId, "gif"),
      blob: file,
      contentType: "image/gif",
    };
  }
  const bitmap = await createImageBitmap(file);
  const size = fitWithin(bitmap.width, bitmap.height, COMMENT_IMAGE_MAX_SIDE);
  const whole = { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
  const blob = await encodeJpeg(bitmap, whole, size.width, size.height);
  bitmap.close();
  return {
    path: commentImagePath(userId, "jpg"),
    blob,
    contentType: "image/jpeg",
  };
}

// Uploads the file into the user's folder and returns where it went. A file
// whose comment then fails to save stays behind: people can't delete their
// files, so a checked image can never be swapped for another.
export async function uploadCommentImage(
  supabase: SupabaseClient,
  userId: string,
  file: File,
): Promise<{ path: string; error?: undefined } | { error: string }> {
  let prepared: PreparedImage;
  try {
    prepared = await prepare(file, userId);
  } catch {
    return { error: "Couldn't read that image. Try a JPEG, PNG or GIF." };
  }

  const { error } = await supabase.storage
    .from(COMMENT_IMAGES_BUCKET)
    .upload(prepared.path, prepared.blob, {
      contentType: prepared.contentType,
      // Short, so a removed image stops being served from caches soon
      cacheControl: "3600",
    });
  return error ? { error: error.message } : { path: prepared.path };
}
