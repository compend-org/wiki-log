// ABOUTME: Reads who the viewer has blocked, so their posts and comments can be
// ABOUTME: left out of what the viewer sees.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommentItem } from "@/components/Comments";

// The ids of everyone the viewer has blocked
export async function getBlockedIds(
  supabase: SupabaseClient,
  viewerId: string | undefined,
): Promise<Set<string>> {
  if (!viewerId) return new Set();

  const { data } = await supabase
    .from("blocks")
    .select("blocked_id")
    .eq("blocker_id", viewerId);

  return new Set((data ?? []).map((r) => r.blocked_id as string));
}

// Comments without those by blocked people, and without the replies under a
// top-level comment that was left out
export function withoutBlockedComments(
  comments: CommentItem[],
  blocked: Set<string>,
): CommentItem[] {
  if (blocked.size === 0) return comments;

  const hidden = new Set(
    comments
      .filter((c) => c.parentId === null && blocked.has(c.authorId))
      .map((c) => c.id),
  );
  return comments.filter(
    (c) => !blocked.has(c.authorId) && !(c.parentId && hidden.has(c.parentId)),
  );
}
