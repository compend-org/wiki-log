// ABOUTME: A list shown as rows: each item's picture and title, the owner's rating, and their note.
// ABOUTME: The list page uses it when the list has notes, unless the reader picked the grid.
import Link from "next/link";
import ItemImage from "@/components/items/ItemImage";
import ClampedNote from "@/components/lists/ClampedNote";
import Stars from "@/components/logs/Stars";
import type { OwnerLatestLog } from "@/lib/lists/listOwnerLogs";
import type { ListPageEntry } from "@/lib/lists/listPages";

export default function ListRows({
  entries,
  ranked,
  owner,
  ownerLatest,
}: {
  entries: ListPageEntry[];
  ranked: boolean;
  // The list owner's name, for the ratings
  owner: string | undefined;
  ownerLatest: Map<string, OwnerLatestLog>;
}) {
  return (
    <ul className="flex flex-col border-b border-line">
      {entries.map((entry) => {
        const href = `/item/${entry.itemId}`;
        const rating = ownerLatest.get(entry.itemId)?.latest.rating ?? null;
        return (
          <li
            key={entry.itemId}
            className={`flex items-start gap-3 border-t border-line ${
              entry.note ? "py-3" : "py-1.5"
            }`}
          >
            {/* The title is the row's link; the picture repeats it for the
                pointer only */}
            <Link
              href={href}
              tabIndex={-1}
              aria-hidden="true"
              className="relative w-14 shrink-0 sm:w-16"
            >
              <ItemImage
                src={entry.imageUrl}
                nsfw={entry.nsfw}
                alt=""
                placeholder={entry.title}
                sourceWidth={160}
                className="aspect-square w-full rounded-lg"
              />
              {ranked && (
                <span className="absolute left-0.5 top-0.5 rounded bg-background/80 px-1 text-xs font-bold text-accent">
                  {entry.rank.toLocaleString("en-US")}
                </span>
              )}
            </Link>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-baseline gap-x-2.5">
                <Link
                  href={href}
                  className="text-[1.05rem] font-semibold hover:underline focus-visible:underline"
                >
                  {ranked && (
                    <span className="sr-only">
                      {entry.rank.toLocaleString("en-US")}.{" "}
                    </span>
                  )}
                  {entry.title}
                </Link>
                {rating !== null && rating > 0 && (
                  <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted">
                    {owner ? `${owner}'s rating` : "Rating"}
                    <Stars rating={rating} />
                  </span>
                )}
              </div>
              {entry.note && <ClampedNote text={entry.note} />}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
