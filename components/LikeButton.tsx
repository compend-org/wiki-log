"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LikeButton({
  viewerId,
  authorId,
  videoId,
  initialCount,
  initiallyLiked,
}: {
  viewerId: string | null;
  authorId: string;
  videoId: string;
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
      ? await supabase.from("likes").insert({
          user_id: viewerId,
          log_user_id: authorId,
          log_video_id: videoId,
        })
      : await supabase
          .from("likes")
          .delete()
          .eq("user_id", viewerId)
          .eq("log_user_id", authorId)
          .eq("log_video_id", videoId);

    if (error) {
      setLiked(!next);
      setCount((c) => c + (next ? -1 : 1));
    }
    setBusy(false);
  }

  // Nothing to show on your own review until someone likes it
  if (own && count === 0) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={own}
      aria-pressed={liked}
      aria-label={liked ? "Unlike this review" : "Like this review"}
      className={`inline-flex items-center gap-1 text-sm disabled:cursor-default ${
        liked ? "text-accent" : "text-muted"
      }`}
    >
      <span aria-hidden="true">{liked ? "♥" : "♡"}</span>
      {count > 0 && <span>{count}</span>}
    </button>
  );
}