// ABOUTME: A heart that likes or unlikes one review.
// ABOUTME: Sends signed-out visitors to log in and shows nothing on your own review until it has likes.
"use client";

import { useRouter } from "next/navigation";
import HeartIcon from "@/components/HeartIcon";
import {
  isLogUnavailable,
  MISSING_LOG_MESSAGE,
  useLogUnavailable,
} from "@/lib/logAvailability";
import { useLike } from "@/lib/useLike";
import { useLoginHref } from "@/lib/useLoginHref";

export default function LikeButton({
  viewerId,
  authorId,
  logId,
  initialCount,
  initiallyLiked,
}: {
  viewerId: string | null;
  authorId: string;
  logId: string;
  initialCount: number;
  initiallyLiked: boolean;
}) {
  const loginHref = useLoginHref();
  const {
    liked,
    count,
    toggle: toggleLike,
    busy,
    errorMessage,
  } = useLike({
    viewerId,
    table: "likes",
    column: "log_id",
    targetId: logId,
    initialCount,
    initiallyLiked,
  });
  const router = useRouter();
  const unavailable = useLogUnavailable(logId);

  const own = viewerId === authorId;

  async function toggle() {
    if (!viewerId) {
      router.push(loginHref);
      return;
    }
    if (own) return;

    await toggleLike();
    if (isLogUnavailable(logId)) router.refresh();
  }

  // Nothing to show on your own review until someone likes it
  if (own && count === 0) return null;

  if (unavailable) {
    return <span role="status">{MISSING_LOG_MESSAGE}</span>;
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={own || busy}
        aria-pressed={liked}
        aria-label={liked ? "Unlike this review" : "Like this review"}
        className={`inline-flex h-5 items-center gap-1 text-sm disabled:cursor-default ${
          liked ? "text-like" : "text-muted enabled:hover:text-like"
        }`}
      >
        <HeartIcon filled={liked} className="h-4 w-4" />
        {count > 0 && <span>{count}</span>}
      </button>
      {errorMessage && <span role="status">{errorMessage}</span>}
    </>
  );
}
