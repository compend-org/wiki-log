// ABOUTME: Prepares and uploads, from the browser, the images someone attaches to a comment.
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

// Deletes the signed-in user's own uploaded comment images
export async function removeOwnCommentImages(
  supabase: SupabaseClient,
  paths: string[],
): Promise<void> {
  if (paths.length > 0)
    await supabase.storage.from(COMMENT_IMAGES_BUCKET).remove(paths);
}

// Uploads the files into the user's folder and returns where they went. If
// any fails, none are kept.
export async function uploadCommentImages(
  supabase: SupabaseClient,
  userId: string,
  files: File[],
): Promise<{ paths: string[]; error?: undefined } | { error: string }> {
  let prepared: PreparedImage[];
  try {
    prepared = await Promise.all(files.map((f) => prepare(f, userId)));
  } catch {
    return { error: "Couldn't read an image. Try a JPEG, PNG or GIF." };
  }

  const paths = prepared.map((p) => p.path);
  const uploads = await Promise.all(
    prepared.map((p) =>
      supabase.storage.from(COMMENT_IMAGES_BUCKET).upload(p.path, p.blob, {
        contentType: p.contentType,
        // Short, so a removed image stops being served from caches soon
        cacheControl: "3600",
      }),
    ),
  );
  const uploadError = uploads.find((u) => u.error)?.error;
  if (uploadError) {
    await removeOwnCommentImages(supabase, paths);
    return { error: uploadError.message };
  }
  return { paths };
}
