// ABOUTME: One log of an item as a card: author, stars, time, review text and actions.
// ABOUTME: The card links to the review's own page, with like, share and comment actions.

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import CardActions from "@/components/logs/CardActions";
import ReviewText from "@/components/logs/ReviewText";
import Stars from "@/components/logs/Stars";
import AdminBadge from "@/components/moderation/AdminBadge";
import LikeButton from "@/components/social/LikeButton";
import ShareButton from "@/components/social/ShareButton";
import { timeAgo } from "@/lib/format";
import type { ItemLogRow } from "@/lib/itemLogs";
import type { ViewerState } from "@/lib/viewerState";

export default function ItemLogCard({
  row,
  isAdmin,
  renderedAt,
  viewerId,
  viewer,
}: {
  row: ItemLogRow;
  isAdmin: boolean;
  renderedAt: number;
  viewerId: string | undefined;
  viewer: ViewerState;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const author = row.profiles?.username;
  const reviewHref = author
    ? `/u/${encodeURIComponent(author)}/${row.id}`
    : null;

  return (
    <div className="card relative flex flex-col gap-1 p-3 hover-or-tap:border-accent/60">
      {reviewHref && (
        <Link
          href={reviewHref}
          aria-label={t("logs.openReview", { author: author ?? "" })}
          className="card-link absolute inset-0 rounded-[inherit]"
        />
      )}
      <div className="flex items-center gap-2 text-sm">
        {author ? (
          <Link
            href={`/u/${encodeURIComponent(author)}`}
            className="relative z-10 hover:underline font-semibold"
          >
            {author}
          </Link>
        ) : (
          <span>{t("common.someone")}</span>
        )}
        {isAdmin && <AdminBadge />}
        <Stars rating={row.rating} />
        <span className="ml-auto text-sm text-muted">
          {timeAgo(row.logged_at, renderedAt, t, locale)}
        </span>
      </div>
      {row.review && (
        <p className="line-clamp-6 text-sm [overflow-wrap:anywhere]">
          <ReviewText text={row.review} />
        </p>
      )}
      <CardActions
        like={
          row.review ? (
            <LikeButton
              viewerId={viewerId ?? null}
              authorId={row.user_id}
              logId={row.id}
              initialCount={row.likes?.[0]?.count ?? 0}
              initiallyLiked={viewer.likedLogs.has(row.id)}
            />
          ) : null
        }
        share={
          <ShareButton
            viewerId={viewerId ?? null}
            ownerId={row.user_id}
            kind="log"
            targetId={row.id}
            shareCount={row.shares?.[0]?.count ?? 0}
            shared={viewer.sharedLogs.has(row.id)}
          />
        }
        commentHref={reviewHref}
        commentCount={row.comments?.[0]?.count ?? 0}
      />
    </div>
  );
}
