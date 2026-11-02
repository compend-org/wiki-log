"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CommentLikeButton({
  viewerId,
  commentId,
  authorId,
  initialCount,
  initiallyLiked,
}: {
  viewerId: string | null;
  commentId: string;
  authorId: string;
  initialCount: number;
  initiallyLiked: boolean;
}) {
  const [liked, setLiked] = useState<boolean>(initiallyLiked);
  const [count, setCount] = useState<number>(initialCount);
  const [busy, setBusy] = useState<boolean>(false);
  const router = useRouter();

  const own = viewerId === authorId;

  async function toggle() {
    if (!viewerId) {
      router.push("/login");
      return;
    }
    if (own || busy) return;

    setBusy(true);
    const next = !liked;
    // Update the screen immediately, undo if the database refuses
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));

    const supabase = createClient();
    const { error } = next
      ? await supabase
          .from("comment_likes")
          .insert({ user_id: viewerId, comment_id: commentId })
      : await supabase
          .from("comment_likes")
          .delete()
          .eq("user_id", viewerId)
          .eq("comment_id", commentId);

    if (error) {
      setLiked(!next);
      setCount((c) => c + (next ? -1 : 1));
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
      aria-pressed={liked}
      aria-label={liked ? "Unlike this comment" : "Like this comment"}
      className={`inline-flex items-center gap-1 disabled:cursor-default ${
        liked ? "text-accent" : "text-muted"
      }`}
    >
      <span aria-hidden="true">{liked ? "♥" : "♡"}</span>
      {count > 0 && <span>{count}</span>}
    </button>
  );
}