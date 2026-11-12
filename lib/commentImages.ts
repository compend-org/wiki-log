// ABOUTME: Limits, storage paths and public URLs for images and GIFs attached to comments.
// ABOUTME: Matches the comment-images bucket and the checks in supabase/migrations/*_comment_images.sql.

export const COMMENT_IMAGES_BUCKET = "comment-images";

// Whether someone can attach images, from the database's
// my_image_attach_status(): accounts under 3 days old and accounts the
// moderators have blocked can't
export type ImageAttachStatus = "allowed" | "new_account" | "blocked";

// Photos are shrunk so their longest side is at most this many pixels
export const COMMENT_IMAGE_MAX_SIDE = 1600;

// GIFs are stored as they are, so they're capped at the bucket's file limit
const MAX_GIF_BYTES = 5 * 1024 * 1024;

// Photos bigger than this aren't read at all, since they're shrunk anyway
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

// Why a file can't be attached to a comment, or null when it can
export function commentImageProblem(file: {
  type: string;
  size: number;
}): string | null {
  if (!file.type.startsWith("image/")) return "Please choose an image or GIF.";
  if (file.type === "image/gif") {
    return file.size > MAX_GIF_BYTES ? "GIFs can be up to 5 MB." : null;
  }
  return file.size > MAX_PHOTO_BYTES ? "Images can be up to 10 MB." : null;
}

// Where a new image goes: a random name inside its uploader's folder
export function commentImagePath(
  userId: string,
  kind: "jpg" | "gif",
  id: string = crypto.randomUUID(),
): string {
  return `${userId}/${id}.${kind}`;
}

// The width and height that fit a picture inside a square of `maxSide`
// pixels, keeping its shape. Smaller pictures keep their size.
export function fitWithin(
  width: number,
  height: number,
  maxSide: number,
): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function commentImageUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${COMMENT_IMAGES_BUCKET}/${path}`;
}
