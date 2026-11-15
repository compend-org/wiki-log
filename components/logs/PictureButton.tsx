// ABOUTME: A review's picture as a button, with a "Change" strip, that opens the picture picker.
// ABOUTME: Stands in for the picture while its author edits the review.
"use client";

import { useState } from "react";
import ItemImage from "@/components/items/ItemImage";
import PicturePicker from "@/components/logs/PicturePicker";
import EditIcon from "@/components/ui/EditIcon";
import type { PictureChoice } from "@/lib/reviewPictures";

export default function PictureButton({
  itemId,
  title,
  url,
  nsfw,
  onPick,
  className,
}: {
  itemId: string;
  title: string;
  // The picture shown now
  url: string | null;
  nsfw: boolean;
  // Null goes back to the item's own picture
  onPick: (choice: PictureChoice | null) => void;
  className: string;
}) {
  const [open, setOpen] = useState<boolean>(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Change the picture for your review"
        className={`relative shrink-0 overflow-hidden rounded ${className}`}
      >
        <ItemImage
          src={url}
          nsfw={nsfw}
          alt={title}
          className="h-full w-full rounded"
        />
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-background/85 py-0.5 text-xs text-foreground">
          <EditIcon className="h-3 w-3" />
          Change
        </span>
      </button>
      {open && (
        <PicturePicker
          itemId={itemId}
          picked={url}
          onPick={onPick}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
