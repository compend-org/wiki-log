// ABOUTME: The row of like, share, comment and log actions at the bottom of a feed card.
// ABOUTME: Keeps room for a one-digit count beside the like icon, so tapping it moves nothing.
import Link from "next/link";
import type { ReactNode } from "react";
import { commentLabel } from "@/lib/format";

export default function CardActions({
  like,
  share,
  commentHref,
  commentCount,
  logHref,
  children,
}: {
  like: ReactNode;
  share: ReactNode;
  commentHref: string | null;
  commentCount: number;
  logHref?: string;
  // Extra details shown before the actions
  children?: ReactNode;
}) {
  return (
    <div className="flex h-5 items-center whitespace-nowrap text-sm text-muted">
      {children && <span className="mr-3.5">{children}</span>}

      <span className="relative z-10 mr-2.5 flex min-w-[1.7rem] empty:hidden">
        {like}
      </span>

      <span className="relative z-10 mr-2.5 flex empty:hidden">{share}</span>

      {commentHref && (
        <Link
          href={commentHref}
          className="relative z-10 mr-2.5 hover:underline"
        >
          {commentLabel(commentCount)}
        </Link>
      )}

      {logHref && (
        <Link href={logHref} className="relative z-10 hover:underline">
          Log
        </Link>
      )}
    </div>
  );
}
