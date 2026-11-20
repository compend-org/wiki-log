// ABOUTME: A card summarising one review: its author, item, rating, text and social actions.
// ABOUTME: Shown wherever reviews appear among other content, such as feeds and profiles.

import Link from "next/link";
import { connection } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import ItemImage from "@/components/items/ItemImage";
import CardActions from "@/components/logs/CardActions";
import CardCorner from "@/components/logs/CardCorner";
import ReviewText from "@/components/logs/ReviewText";
import SharedLabel, { type Sharer } from "@/components/logs/SharedLabel";
import Stars from "@/components/logs/Stars";
import UserName from "@/components/people/UserName";
import LikeButton from "@/components/social/LikeButton";
import ShareButton from "@/components/social/ShareButton";
import ShareIcon from "@/components/social/ShareIcon";
import type { LogRow } from "@/lib/feed/feedData";
import { entryPicture, timeAgo } from "@/lib/format";

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
  const t = await getTranslations();
  const locale = await getLocale();
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
          aria-label={t("feed.openReview", {
            author: author ?? "",
            title: title ?? "",
          })}
          className="card-link absolute inset-0 rounded-[inherit]"
        />
      )}
      {(topControls || controls) && (
        <CardCorner>
          {topControls}
          {controls}
        </CardCorner>
      )}
      <Link
        href={reviewHref ?? `/item/${row.item_id}`}
        className="card-link relative z-10 shrink-0 self-center"
      >
        <ItemImage
          src={entryPicture(row)}
          nsfw={row.items?.nsfw}
          alt={title}
          className="h-20 w-20 rounded"
          sourceWidth={250}
        />
      </Link>

      <div
        className={`flex min-w-0 flex-col gap-1 ${
          topControls || controls ? (row.review ? "pr-7 @xl:pr-0" : "pr-7") : ""
        }`}
      >
        {sharers.length > 0 && (
          <span className="flex flex-wrap items-center gap-x-1 text-sm text-muted">
            <ShareIcon className="h-3.5 w-3.5" />
            <SharedLabel sharers={sharers} />
          </span>
        )}
        <span className="flex flex-wrap items-center gap-x-1 text-sm text-muted">
          {showAuthor && (
            <>
              <UserName
                userId={row.user_id}
                username={author}
                avatarPath={avatarPath}
              />
              <span>{t("logs.logged")}</span>
            </>
          )}
          <span className="whitespace-nowrap">
            {showAuthor && "· "}
            {timeAgo(row.logged_at, renderedAt, t, locale)}
          </span>
        </span>

        <div className="flex items-baseline justify-between gap-3">
          <Link
            href={`/item/${row.item_id}`}
            className="relative z-10 w-fit block max-w-full min-w-0 line-clamp-2 [overflow-wrap:anywhere] font-semibold"
          >
            {title}
          </Link>
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
              shareCount={row.shares?.[0]?.count ?? 0}
              shared={shared}
            />
          }
          commentHref={reviewHref}
          commentCount={row.comments?.[0]?.count ?? 0}
          logHref={`/item/${row.item_id}#log`}
        />
      </div>

      {row.review && (
        <div
          className={`col-span-2 line-clamp-6 break-words text-sm @xl:col-span-1 @xl:border-l @xl:border-dashed @xl:border-line @xl:pl-4 ${
            topControls || controls ? "@xl:pr-7" : ""
          }`}
        >
          {<ReviewText text={row.review} />}
        </div>
      )}
    </div>
  );
}
