// ABOUTME: A review list's entries, one row each: the item's picture, its title, the rating and the review.
// ABOUTME: The picture and title link to the full review; long reviews are cut short.
import Link from "next/link";
import ItemImage from "@/components/items/ItemImage";
import ReviewText from "@/components/logs/ReviewText";
import Stars from "@/components/logs/Stars";
import Avatar from "@/components/people/Avatar";
import { timeAgo } from "@/lib/format";
import type { ListPageEntry } from "@/lib/lists/listPages";

export default function ReviewRows({
  entries,
  ranked,
  renderedAt,
}: {
  // Entries whose review the viewer can see
  entries: (ListPageEntry & { review: NonNullable<ListPageEntry["review"]> })[];
  ranked: boolean;
  renderedAt: number;
}) {
  return (
    <ul className="flex flex-col border-b border-line">
      {entries.map((entry) => {
        const { review } = entry;
        const reviewHref = `/u/${encodeURIComponent(review.username)}/${review.logId}`;
        return (
          <li
            key={entry.entryId}
            className="flex items-start gap-3 border-t border-line py-4"
          >
            <Link href={reviewHref} className="relative shrink-0">
              <ItemImage
                src={entry.imageHidden ? null : entry.imageUrl}
                nsfw={entry.nsfw}
                alt={entry.title}
                className="h-14 w-14 rounded-lg sm:h-16 sm:w-16"
              />
              {ranked && (
                <span className="absolute left-0.5 top-0.5 rounded bg-background/80 px-1 text-xs font-bold text-accent">
                  {entry.rank}
                </span>
              )}
            </Link>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="flex flex-wrap items-baseline gap-x-2">
                <Link href={reviewHref} className="font-semibold">
                  {entry.title}
                </Link>
                <Stars rating={review.rating} />
              </p>
              <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
                <Link
                  href={`/u/${encodeURIComponent(review.username)}`}
                  className="inline-flex items-center gap-1.5 hover:underline"
                >
                  <Avatar
                    name={review.username}
                    path={review.avatarPath}
                    size={20}
                  />
                  {review.username}
                </Link>
                <span>· {timeAgo(review.loggedAt, renderedAt)}</span>
              </p>
              <p className="line-clamp-4 whitespace-pre-wrap break-words">
                <ReviewText text={review.text} />
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
