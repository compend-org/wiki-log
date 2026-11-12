// ABOUTME: Server-only handling of the files behind review and comment images, whoever uploaded them.
// ABOUTME: Deletes them with their post, and hides them in a private bucket while the moderators have it removed.

import { API_MAX_ROWS, chunks, fetchRows } from "@/lib/allRows";
import {
  POST_IMAGES_BUCKET,
  type PostImageTable,
  storedFiles,
} from "@/lib/postImages";
import { createAdminClient } from "@/lib/supabase/admin";

// Private: only the server can read it. Files keep their paths here, so
// moving them back restores the post's images as they were.
const REMOVED_POST_IMAGES_BUCKET = "removed-post-images";

// The files stored for a post's images, and for its replies' images too when
// asked, however many there are. Copies only exist once the images have been
// checked. Read past RLS, so posts hidden by the moderators count.
export async function postImageFiles(
  table: PostImageTable,
  postId: string,
  withReplies: boolean,
): Promise<{ files: string[]; error?: string }> {
  const admin = createAdminClient();
  const { rows, error } = await fetchRows<{
    images: string[];
    images_checked_at: string | null;
  }>((from, to) => {
    const query = admin
      .from(table)
      .select("images, images_checked_at")
      .not("images", "eq", "{}")
      .order("id")
      .range(from, to);
    return withReplies
      ? query.or(`id.eq.${postId},parent_id.eq.${postId}`)
      : query.eq("id", postId);
  });
  const files = rows.flatMap((row) =>
    row.images_checked_at ? row.images.flatMap(storedFiles) : row.images,
  );
  return { files, error };
}

// Deletes the files, whether they're shown or hidden
export async function deletePostImageFiles(files: string[]): Promise<void> {
  if (files.length === 0) return;
  const storage = createAdminClient().storage;
  for (const batch of chunks(files, API_MAX_ROWS)) {
    await Promise.all([
      storage.from(POST_IMAGES_BUCKET).remove(batch),
      storage.from(REMOVED_POST_IMAGES_BUCKET).remove(batch),
    ]);
  }
}

// Moves the files between buckets, keeping their paths. Returns how many
// couldn't be moved.
async function movePostImageFiles(
  files: string[],
  from: string,
  to: string,
): Promise<number> {
  const storage = createAdminClient().storage.from(from);
  const moves = await Promise.all(
    files.map((file) => storage.move(file, file, { destinationBucket: to })),
  );
  return moves.filter((m) => m.error).length;
}

// Takes the files off their public URLs
export function hidePostImageFiles(files: string[]): Promise<number> {
  return movePostImageFiles(
    files,
    POST_IMAGES_BUCKET,
    REMOVED_POST_IMAGES_BUCKET,
  );
}

// Puts hidden files back on their public URLs
export function showPostImageFiles(files: string[]): Promise<number> {
  return movePostImageFiles(
    files,
    REMOVED_POST_IMAGES_BUCKET,
    POST_IMAGES_BUCKET,
  );
}

// Every bucket that holds someone's post images, shown or hidden
export const POST_IMAGE_BUCKETS = [
  POST_IMAGES_BUCKET,
  REMOVED_POST_IMAGES_BUCKET,
];
