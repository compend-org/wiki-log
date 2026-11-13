// ABOUTME: One long review in the Digest tab, shown in full.
// ABOUTME: The whole card opens the review; the links and buttons on it work on their own.
import Link from "next/link";
import LikeButton from "@/components/buttons/LikeButton";
import ShareButton from "@/components/buttons/ShareButton";
import CardActions from "@/components/CardActions";
import ItemImage from "@/components/icons/ItemImage";
import ReviewText from "@/components/ReviewText";
import Stars from "@/components/Stars";
import UserName from "@/components/UserName";
import type { DigestLog } from "@/lib/digest";
import { timeAgo } from "@/lib/format";

export default function DigestCard({
  row,
  viewerId,
  liked,
  shared,
  now,
}: {
  row: DigestLog;
  viewerId: string | undefined;
  liked: boolean;
  shared: boolean;
  now: number;
}) {
  const title = row.items?.title ?? "Unknown item";
  const author = row.profiles?.username;
  const reviewHref = author
    ? `/u/${encodeURIComponent(author)}/${row.id}`
    : null;

  return (
    <article className="card relative flex flex-col gap-3 p-4 hover-or-tap:border-accent/60">
      {reviewHref && (
        <Link
          href={reviewHref}
          aria-label={`Open ${author}'s review of ${title}`}
          className="absolute inset-0 rounded-[inherit]"
        />
      )}

      <div className="flex items-center gap-3">
        <Link href={`/item/${row.item_id}`} className="relative z-10 shrink-0">
          <ItemImage
            src={row.items?.image_url}
            nsfw={row.items?.nsfw}
            alt={title}
            className="h-16 w-16 rounded"
            sourceWidth={250}
          />
        </Link>
        <div className="flex min-w-0 flex-col gap-1">
          <Link
            href={`/item/${row.item_id}`}
            className="relative z-10 w-fit font-semibold"
          >
            {title}
          </Link>
          <Stars rating={row.rating} />
          <span className="flex flex-wrap items-center gap-x-1 text-sm text-muted">
            <UserName
              userId={row.user_id}
              username={author}
              avatarPath={row.profiles?.avatar_path ?? null}
            />
            <span className="whitespace-nowrap">
              · {timeAgo(row.logged_at, now)}
            </span>
          </span>
        </div>
      </div>

      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
        <ReviewText text={row.review} />
      </p>

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
    </article>
  );
}
