// ABOUTME: Sizes, storage paths and public URLs for profile pictures.
// ABOUTME: Each picture is stored twice: full size, and a small copy for tiny displays.
import { supabaseUrl } from "@/lib/supabase/connection";

// Width and height in pixels of the stored square pictures
export const AVATAR_SIZE = 256;
export const AVATAR_SMALL_SIZE = 64;

// The small copy is used when it stays sharp on screens with 3x pixel density
const SMALL_MAX_DISPLAY_SIZE = AVATAR_SMALL_SIZE / 3;

// Where the small copy of a picture is stored: next to it, with "-small"
// before the extension
export function smallAvatarPath(path: string): string {
  return path.replace(/\.jpg$/, "-small.jpg");
}

// The public URL of a picture, picking the small copy when it is shown at
// `displaySize` pixels or less. Without a display size, the full picture.
export function avatarUrl(
  path: string | null | undefined,
  displaySize?: number,
): string | null {
  if (!path) return null;
  const stored =
    displaySize !== undefined && displaySize <= SMALL_MAX_DISPLAY_SIZE
      ? smallAvatarPath(path)
      : path;
  return `${supabaseUrl()}/storage/v1/object/public/avatars/${stored}`;
}
