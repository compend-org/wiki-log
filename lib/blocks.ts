// ABOUTME: Leaves comments by people the viewer has blocked out of what the
// ABOUTME: viewer sees.
import type { CommentItem } from "@/components/Comments";

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
