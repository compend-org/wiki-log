// ABOUTME: Server-only handling of comment image files, whoever uploaded them.
// ABOUTME: Deletes them with their comment, and hides them in a private bucket while the moderators have it removed.

import { COMMENT_IMAGES_BUCKET } from "@/lib/commentImages";
import type { CommentTable } from "@/lib/comments";
import { createAdminClient } from "@/lib/supabase/admin";

// Private: only the server can read it. Files keep their paths here, so
// moving them back restores the comment's images as they were.
const REMOVED_COMMENT_IMAGES_BUCKET = "removed-comment-images";

// The image paths of a comment, and of its replies too when asked. Read past
// RLS, so comments hidden by the moderators count.
export async function commentImagePaths(
  table: CommentTable,
  commentId: string,
  withReplies: boolean,
): Promise<{ paths: string[]; error?: string }> {
  const query = createAdminClient().from(table).select("images");
  const { data, error } = await (withReplies
    ? query.or(`id.eq.${commentId},parent_id.eq.${commentId}`)
    : query.eq("id", commentId));
  if (error) return { paths: [], error: error.message };
  return { paths: (data ?? []).flatMap((row) => row.images as string[]) };
}

// Deletes the files, whether they're shown or hidden
export async function deleteCommentImageFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const storage = createAdminClient().storage;
  await Promise.all([
    storage.from(COMMENT_IMAGES_BUCKET).remove(paths),
    storage.from(REMOVED_COMMENT_IMAGES_BUCKET).remove(paths),
  ]);
}

// Moves the files between buckets, keeping their paths. Returns how many
// couldn't be moved.
async function moveCommentImageFiles(
  paths: string[],
  from: string,
  to: string,
): Promise<number> {
  const storage = createAdminClient().storage.from(from);
  const moves = await Promise.all(
    paths.map((path) => storage.move(path, path, { destinationBucket: to })),
  );
  return moves.filter((m) => m.error).length;
}

// Takes the files off their public URLs
export function hideCommentImageFiles(paths: string[]): Promise<number> {
  return moveCommentImageFiles(
    paths,
    COMMENT_IMAGES_BUCKET,
    REMOVED_COMMENT_IMAGES_BUCKET,
  );
}

// Puts hidden files back on their public URLs
export function showCommentImageFiles(paths: string[]): Promise<number> {
  return moveCommentImageFiles(
    paths,
    REMOVED_COMMENT_IMAGES_BUCKET,
    COMMENT_IMAGES_BUCKET,
  );
}

// Every bucket that holds someone's comment images, shown or hidden
export const COMMENT_IMAGE_BUCKETS = [
  COMMENT_IMAGES_BUCKET,
  REMOVED_COMMENT_IMAGES_BUCKET,
];
