// ABOUTME: Limits, storage paths and public URLs for the image or GIF attached to a review or comment.
// ABOUTME: Matches the post-images bucket and the checks in supabase/migrations/*_post_images.sql.

export const POST_IMAGES_BUCKET = "post-images";

// The tables whose rows can carry images
export type PostImageTable = "logs" | "comments" | "list_comments";
export const POST_IMAGE_TABLES: PostImageTable[] = [
  "logs",
  "comments",
  "list_comments",
];

// Whether someone can attach images, from the database's
// my_image_attach_status(): accounts under 3 days old and accounts the
// moderators have blocked can't
export type ImageAttachStatus = "allowed" | "new_account" | "blocked";

// Photos are shrunk so their longest side is at most this many pixels
export const POST_IMAGE_MAX_SIDE = 1600;

// Smaller copies of each photo, made by the server when it checks the photo,
// and the box in pixels each one fits inside. GIFs have none, so they keep
// moving wherever they're shown.
export const POST_IMAGE_COPIES = {
  // Comments and thumbnails, shown up to 160px tall
  small: { width: 640, height: 320 },
  // The full width of a phone screen
  medium: { width: 800, height: 1600 },
} as const;
export type PostImageCopy = keyof typeof POST_IMAGE_COPIES;
export type PostImageSize = PostImageCopy | "full";

// GIFs are stored as they are, so they're capped at the bucket's file limit
const MAX_GIF_BYTES = 5 * 1024 * 1024;

// Photos bigger than this aren't read at all, since they're shrunk anyway
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

// Why a file can't be attached, or null when it can
export function postImageProblem(file: {
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
export function postImagePath(
  userId: string,
  kind: "jpg" | "gif",
  id: string = crypto.randomUUID(),
): string {
  return `${userId}/${id}.${kind}`;
}

// Where the server puts a copy of the photo at `path`, or null for a GIF
export function copyPath(path: string, copy: PostImageCopy): string | null {
  return path.endsWith(".jpg") ? path.replace(/\.jpg$/, `-${copy}.jpg`) : null;
}

// Every file stored for the image at `path`: itself and its copies
export function storedFiles(path: string): string[] {
  const copies = (Object.keys(POST_IMAGE_COPIES) as PostImageCopy[])
    .map((copy) => copyPath(path, copy))
    .filter((p): p is string => p !== null);
  return [path, ...copies];
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

// The public URL of the image at `path`, at `size`. Until the image has been
// checked its copies don't exist yet, so the full file is used meanwhile.
export function postImageUrl(
  path: string,
  size: PostImageSize = "full",
  checked = true,
): string {
  const copy = size !== "full" && checked ? copyPath(path, size) : null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${POST_IMAGES_BUCKET}/${copy ?? path}`;
}
