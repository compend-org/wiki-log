// ABOUTME: Prepares and uploads, from the browser, the image someone attaches to a review or comment.
// ABOUTME: Photos are shrunk and re-encoded as JPEG; GIFs go up unchanged so they keep moving.
import type { SupabaseClient } from "@supabase/supabase-js";
import { encodeJpeg } from "@/lib/jpeg";
import {
  fitWithin,
  POST_IMAGE_MAX_SIDE,
  POST_IMAGES_BUCKET,
  postImagePath,
} from "@/lib/postImages";

type PreparedImage = { path: string; blob: Blob; contentType: string };

async function prepare(file: File, userId: string): Promise<PreparedImage> {
  if (file.type === "image/gif") {
    return {
      path: postImagePath(userId, "gif"),
      blob: file,
      contentType: "image/gif",
    };
  }
  const bitmap = await createImageBitmap(file);
  const size = fitWithin(bitmap.width, bitmap.height, POST_IMAGE_MAX_SIDE);
  const whole = { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
  const blob = await encodeJpeg(bitmap, whole, size.width, size.height);
  bitmap.close();
  return {
    path: postImagePath(userId, "jpg"),
    blob,
    contentType: "image/jpeg",
  };
}

// Uploads the file into the user's folder and returns where it went. A file
// whose post then fails to save stays behind: people can't delete their
// files, so a checked image can never be swapped for another.
export async function uploadPostImage(
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
    .from(POST_IMAGES_BUCKET)
    .upload(prepared.path, prepared.blob, {
      contentType: prepared.contentType,
      // Short, so a removed image stops being served from caches soon
      cacheControl: "3600",
    });
  return error ? { error: error.message } : { path: prepared.path };
}
