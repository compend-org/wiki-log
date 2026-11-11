// ABOUTME: A heart that likes or unlikes one list.
// ABOUTME: Sends signed-out visitors to log in.
"use client";

import { useRouter } from "next/navigation";
import HeartIcon from "@/components/HeartIcon";
import { useLike } from "@/lib/useLike";
import { useLoginHref } from "@/lib/useLoginHref";

export default function ListLikeButton({
  viewerId,
  listId,
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

  async function toggle() {
    if (!viewerId) {
      router.push(loginHref);
      return;
    }

    await toggleLike();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={liked}
      aria-label={liked ? "Unlike this list" : "Like this list"}
      className={`inline-flex h-5 items-center gap-1 text-sm ${
        liked ? "text-like" : "text-muted enabled:hover:text-like"
      }`}
    >
      <HeartIcon filled={liked} className="h-4 w-4" />
      {count > 0 && <span>{count}</span>}
    </button>
  );
}
