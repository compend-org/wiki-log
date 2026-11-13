// ABOUTME: One of your logs in your diary, with buttons to edit or delete it.
// ABOUTME: Shows what the server sent, plus an edit saved here until the server sends it back.
"use client";

import Link from "next/link";
import { useState } from "react";
import DeleteButton from "@/components/buttons/DeleteButton";
import EditEntryForm from "@/components/EditEntryForm";
import EditIcon from "@/components/icons/EditIcon";
import ItemImage from "@/components/icons/ItemImage";
import ReviewText from "@/components/ReviewText";
import Stars from "@/components/Stars";
import { useLocalCopy } from "@/lib/useLocalCopy";

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
}) {
  const [editing, setEditing] = useState<boolean>(false);
  const [deleted, setDeleted] = useState<boolean>(false);
  // A saved edit shows straight away. Pages loaded after the first aren't
  // sent again, so it stays until the server sends a different saved entry.
  const [shownRating, setShownRating] = useLocalCopy(rating);
  const [shownReview, setShownReview] = useLocalCopy(review);

  if (deleted) return null;

  return (
    <div className="card flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between gap-3 text-xs text-muted">
        <span>
          {entryHref ? (
            <Link href={entryHref} className="underline">
              {ago}
            </Link>
          ) : (
            ago
          )}
          {" · You logged"}
        </span>
        <span className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Edit this entry"
            title="Edit this entry"
            className="flex text-accent hover:opacity-70 hover:text-foreground"
          >
            <EditIcon className="h-4 w-4" />
          </button>
          <DeleteButton
            kind="log"
            targetId={logId}
            onDeleted={() => setDeleted(true)}
          />
        </span>
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
          <Link href={`/item/${itemId}`} className="shrink-0">
            <ItemImage
              src={imageUrl}
              nsfw={nsfw}
              alt={title}
              className="h-16 w-16 rounded"
            />
          </Link>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <Link href={`/item/${itemId}`} className="w-fit font-semibold">
              {title}
            </Link>
            <Stars rating={shownRating} />
            {shownReview && (
              <p className="line-clamp-2 whitespace-pre-wrap break-words text-sm">
                <ReviewText text={shownReview} />
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
