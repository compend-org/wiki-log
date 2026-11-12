// ABOUTME: A card summarising one review: its author, item, rating, text and social actions.
// ABOUTME: Shown wherever reviews appear among other content, such as feeds and profiles.
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import LikeButton from "@/components/buttons/LikeButton";
import ShareButton from "@/components/buttons/ShareButton";
import CardActions from "@/components/CardActions";
import ItemImage from "@/components/icons/ItemImage";
import ShareIcon from "@/components/icons/ShareIcon";
import Stars from "@/components/Stars";
import UserName from "@/components/UserName";
import type { LogRow } from "@/lib/feedData";
import { timeAgo } from "@/lib/format";
import ReviewText from "./ReviewText";
import SharedLabel, { type Sharer } from "./SharedLabel";

// The layout follows the width of the column the card sits in (the "@xl:"
// variants), not the width of the screen
export default async function LogCard({
  log: row,
  viewerId,
  liked,
  shared,
  sharers = [],
  showAuthor = true,
  controls,
  topControls,
}: {
  log: LogRow;
  viewerId: string | undefined;
  liked: boolean;
  shared: boolean;
  // The people to credit for sharing this review, newest first
  sharers?: Sharer[];
  // Whether to name the author, which a page about that person doesn't need
  showAuthor?: boolean;
  // Extra controls beside the title, such as Pin
  controls?: ReactNode;
  topControls?: ReactNode;
}) {
  await connection();
  const renderedAt = Date.now();
  const title = row.items?.title ?? "Unknown item";
  const author = row.profiles?.username;
  const avatarPath = row.profiles?.avatar_path ?? null;
  const reviewHref = author
    ? `/u/${encodeURIComponent(author)}/${row.id}`
    : null;

  return (
    <div
      className={`card relative grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 p-3 hover-or-tap:border-accent/60 ${
        row.review ? "@xl:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.2fr)]" : ""
      }`}
    >
      {reviewHref && (
        <Link
          href={reviewHref}
          aria-label={`Open ${author}'s review of ${title}`}
          className="absolute inset-0 rounded-[inherit]"
        />
      )}

      <Link
        href={`/item/${row.item_id}`}
        className="relative z-10 shrink-0 self-center"
      >
        <ItemImage
          src={row.items?.image_url}
          alt={title}
          className="h-20 w-20 rounded"
          sourceWidth={250}
        />
      </Link>

      <div className="flex min-w-0 flex-col gap-1">
        {sharers.length > 0 && (
          <span className="flex flex-wrap items-center gap-x-1 text-sm text-muted">
            <ShareIcon className="h-3.5 w-3.5" />
            <SharedLabel sharers={sharers} />
          </span>
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="flex flex-wrap items-center gap-x-1 text-sm text-muted">
            {showAuthor && (
              <>
                <UserName
                  userId={row.user_id}
                  username={author}
                  avatarPath={avatarPath}
                />
                <span>logged</span>
              </>
            )}
            <span className="whitespace-nowrap">
              {showAuthor && "· "}
              {timeAgo(row.logged_at, renderedAt)}
            </span>
          </span>
          {topControls}
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <Link
            href={`/item/${row.item_id}`}
            className="relative z-10 w-fit font-semibold"
          >
            {title}
          </Link>
          {controls}
        </div>
        <Stars rating={row.rating} />
        <CardActions
          like={
            <LikeButton
              viewerId={viewerId ?? null}
              authorId={row.user_id}
              logId={row.id}
              initialCount={row.likes?.[0]?.count ?? 0}
              initiallyLiked={liked}
            />
          }
          share={
            <ShareButton
              viewerId={viewerId ?? null}
              ownerId={row.user_id}
              kind="log"
              targetId={row.id}
              initialCount={row.shares?.[0]?.count ?? 0}
              initiallyShared={shared}
            />
          }
          commentHref={reviewHref}
          commentCount={row.comments?.[0]?.count ?? 0}
          logHref={`/item/${row.item_id}#log`}
        />
      </div>

      {row.review && (
        <p className="col-span-2 line-clamp-6 whitespace-pre-wrap break-words text-sm @xl:col-span-1 @xl:border-l @xl:border-dashed @xl:border-line @xl:pl-4">
          {<ReviewText text={row.review} />}
        </p>
      )}
    </div>
  );
}
