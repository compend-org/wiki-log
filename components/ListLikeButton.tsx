// ABOUTME: A heart that likes or unlikes one list.
// ABOUTME: Sends signed-out visitors to log in and shows nothing on your own list until it has likes.
"use client";

import { useRouter } from "next/navigation";
import HeartIcon from "@/components/HeartIcon";
import { useLike } from "@/lib/useLike";
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
  const {
    liked,
    count,
    toggle: toggleLike,
  } = useLike({
    viewerId,
    table: "list_likes",
    column: "list_id",
    targetId: listId,
    initialCount,
    initiallyLiked,
  });
  const router = useRouter();

  const own = viewerId === ownerId;

  async function toggle() {
    if (!viewerId) {
      router.push(loginHref);
      return;
    }
    if (own) return;

    await toggleLike();
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
