"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import HeartIcon from "@/components/HeartIcon";
import { track } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";
import { useLocalCopy } from "@/lib/useLocalCopy";
import { useLoginHref } from "@/lib/useLoginHref";

// Where likes on each kind of comment are kept
const LIKES = {
  comments: { table: "comment_likes", column: "comment_id" },
  list_comments: { table: "list_comment_likes", column: "list_comment_id" },
} as const;

export default function CommentLikeButton({
  viewerId,
  commentTable,
  commentId,
  authorId,
  likeCount,
  liked,
}: {
  viewerId: string | null;
  // "comments" for reviews, "list_comments" for lists
  commentTable: keyof typeof LIKES;
  commentId: string;
  authorId: string;
  likeCount: number;
  liked: boolean;
}) {
  const loginHref = useLoginHref();
  const [shownLiked, setShownLiked] = useLocalCopy(liked);
  // The server's count already includes the viewer's like when it says liked
  const count = likeCount + Number(shownLiked) - Number(liked);
  const [busy, setBusy] = useState<boolean>(false);
  const router = useRouter();

  const own = viewerId === authorId;

  async function toggle() {
    if (!viewerId) {
      router.push(loginHref);
      return;
    }
    if (own || busy) return;

    setBusy(true);
    const next = !shownLiked;
    // Update the screen immediately, undo if the database refuses
    setShownLiked(next);

    const likes = LIKES[commentTable];
    const supabase = createClient();
    const { error } = next
      ? await supabase
          .from(likes.table)
          .insert({ user_id: viewerId, [likes.column]: commentId })
      : await supabase
          .from(likes.table)
          .delete()
          .eq("user_id", viewerId)
          .eq(likes.column, commentId);

    if (error) {
      setShownLiked(!next);
    } else {
      track(next ? "liked" : "unliked", { target: "comment" });
    }
    setBusy(false);
  }

  // Nothing to show on your own comment until someone likes it
  if (own && count === 0) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={own}
      aria-pressed={shownLiked}
      aria-label={shownLiked ? "Unlike this comment" : "Like this comment"}
      className={`inline-flex items-center gap-1 disabled:cursor-default ${
        shownLiked ? "text-like" : "text-muted enabled:hover:text-like"
      }`}
    >
      <HeartIcon filled={shownLiked} className="h-3.5 w-3.5" />
      {count > 0 && <span>{count}</span>}
    </button>
  );
}
