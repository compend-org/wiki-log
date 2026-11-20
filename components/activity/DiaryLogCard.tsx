// ABOUTME: One of your logs in your diary, with buttons to edit or delete it.
// ABOUTME: Shows what the server sent, plus an edit saved here until the server sends it back.
"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import ItemImage from "@/components/items/ItemImage";
import DeleteButton from "@/components/logs/DeleteButton";
import EditEntryForm from "@/components/logs/EditEntryForm";
import ReviewText from "@/components/logs/ReviewText";
import Stars from "@/components/logs/Stars";
import EditIcon from "@/components/ui/EditIcon";
import { useLocalCopy } from "@/lib/hooks/useLocalCopy";

export default function DiaryLogCard({
  logId,
  itemId,
  title,
  imageUrl,
  nsfw,
  rating,
  review,
  ago,
  entryHref,
  author,
  owner,
}: {
  logId: string;
  itemId: string;
  title: string;
  imageUrl: string | null;
  // Adult content, blurred in SFW mode until tapped
  nsfw: boolean;
  rating: number | null;
  review: string;
  // When it was logged, as shown: "5m ago", or the date once it's a day old
  ago: string;
  // The entry's own page, when its owner's username is known
  entryHref: string | null;
  // Set for a review by someone else that you liked, which has no edit or
  // delete buttons. "When" is then when you liked it.
  author?: string;
  owner?: string;
}) {
  const t = useTranslations();
  const who = owner ?? "You";
  const [editing, setEditing] = useState<boolean>(false);
  const [deleted, setDeleted] = useState<boolean>(false);
  // A saved edit shows straight away. Pages loaded after the first aren't
  // sent again, so it stays until the server sends a different saved entry.
  const [shownRating, setShownRating] = useLocalCopy(rating);
  const [shownReview, setShownReview] = useLocalCopy(review);

  if (deleted) return null;

  // The whole card opens the entry, except while editing, so the form can be used
  const opensEntry = entryHref !== null && !editing;

  return (
    <div
      className={`card relative flex flex-col gap-2 p-3 ${
        opensEntry ? "hover-or-tap:border-accent/60" : ""
      }`}
    >
      {opensEntry && (
        <Link
          href={entryHref}
          aria-label={
            author
              ? t("logs.openEntryFor", { author, title })
              : `Open ${owner ? `${owner}'s` : "your"} entry for ${title}`
          }
          className="card-link absolute inset-0 rounded-[inherit]"
        />
      )}
      <div className="flex items-center justify-between gap-3 text-xs text-muted">
        <span>
          {ago} · {author ? `${who} liked ${author}'s review` : `${who} logged`}
        </span>
        {!author && !owner && (
          <span className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={t("logs.editEntry")}
              title={t("logs.editEntry")}
              className="relative z-10 flex text-accent hover:opacity-70 hover:text-foreground"
            >
              <EditIcon className="h-4 w-4" />
            </button>
            <DeleteButton
              kind="log"
              targetId={logId}
              onDeleted={() => setDeleted(true)}
            />
          </span>
        )}
      </div>

      {editing ? (
        <EditEntryForm
          logId={logId}
          initialRating={shownRating}
          initialReview={shownReview}
          onCancel={() => setEditing(false)}
          onSaved={(savedRating, savedReview) => {
            setShownRating(savedRating);
            setShownReview(savedReview);
            setEditing(false);
          }}
        />
      ) : (
        <div className="flex items-center gap-3">
          <Link href={`/item/${itemId}`} className="relative z-10 shrink-0">
            <ItemImage
              src={imageUrl}
              nsfw={nsfw}
              alt={title}
              className="h-16 w-16 rounded"
            />
          </Link>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <Link
              href={`/item/${itemId}`}
              className="relative z-10 w-fit block max-w-full min-w-0 line-clamp-2 [overflow-wrap:anywhere] font-semibold"
            >
              {title}
            </Link>
            <Stars rating={shownRating} />
            {shownReview && (
              <div className="line-clamp-2 break-words text-sm">
                <ReviewText text={shownReview} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
