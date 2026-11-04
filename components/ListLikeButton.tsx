"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import HeartIcon from "@/components/HeartIcon";
import { createClient } from "@/lib/supabase/client";
import { useLoginHref } from "@/lib/useLoginHref";

export default function ListLikeButton({
  viewerId,
  listId,
  ownerId,
  initialCount,
  initiallyLiked,
}: {
  viewerId: string | null;
  listId: string;
  ownerId: string;
  initialCount: number;
  initiallyLiked: boolean;
}) {
  const loginHref = useLoginHref();
  const [liked, setLiked] = useState<boolean>(initiallyLiked);
  const [count, setCount] = useState<number>(initialCount);
  const [busy, setBusy] = useState<boolean>(false);
  const router = useRouter();

  const own = viewerId === ownerId;

  async function toggle() {
    if (!viewerId) {
      router.push(loginHref);
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
          .from("list_likes")
          .insert({ user_id: viewerId, list_id: listId })
      : await supabase
          .from("list_likes")
          .delete()
          .eq("user_id", viewerId)
          .eq("list_id", listId);

    if (error) {
      setLiked(!next);
      setCount((c) => c + (next ? -1 : 1));
    }
    setBusy(false);
  }

  // Nothing to show on your own list until someone likes it
  if (own && count === 0) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={own}
      aria-pressed={liked}
      aria-label={liked ? "Unlike this list" : "Like this list"}
      className={`inline-flex items-center gap-1 text-sm disabled:cursor-default ${
        liked ? "text-like" : "text-muted enabled:hover:text-like"
      }`}
    >
      <HeartIcon filled={liked} className="h-4 w-4" />
      {count > 0 && <span>{count}</span>}
    </button>
  );
}
