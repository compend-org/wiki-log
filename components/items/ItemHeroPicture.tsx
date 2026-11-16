// ABOUTME: The big picture at the top of an item's page, with its credit underneath.
// ABOUTME: Signed-in visitors can pick another picture from the article for the review they're writing.
"use client";

import { type ReactNode, useState } from "react";
import ItemPicture from "@/components/items/ItemPicture";
import { useReviewPicture } from "@/components/items/ReviewPictureContext";
import PicturePicker from "@/components/logs/PicturePicker";
import EditIcon from "@/components/ui/EditIcon";

export default function ItemHeroPicture({
  itemId,
  title,
  imageUrl,
  nsfw,
  className,
  credit,
  canPick,
}: {
  itemId: string;
  title: string;
  // The item's own picture
  imageUrl: string;
  nsfw: boolean;
  className: string;
  // Shown under the item's own picture
  credit: ReactNode;
  // Whether the visitor can pick a picture for their review
  canPick: boolean;
}) {
  const { picked, pick } = useReviewPicture();
  const [open, setOpen] = useState<boolean>(false);
  // The picture picked for the review, when it isn't the item's own
  const chosen = picked && !picked.isDefault ? picked : null;
  const shown = chosen?.url ?? imageUrl;

  return (
    <figure className="flex flex-col items-center gap-1">
      <div className="relative max-w-full">
        <ItemPicture
          src={shown}
          fullSize
          alt={title}
          nsfw={nsfw}
          className={className}
        />
        {canPick && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Choose the picture for your review"
            title="Choose the picture for your review"
            className="absolute bottom-2 right-2 flex items-center gap-1 border border-line bg-background/90 px-2 py-1 text-xs text-foreground"
          >
            <EditIcon className="h-3 w-3" />
            Change
          </button>
        )}
      </div>
      <figcaption className="text-center text-xs text-muted">
        {chosen ? (
          <>
            Picture for your review · Image:{" "}
            {chosen.filePage ? (
              <a href={chosen.filePage} className="underline">
                Wikimedia Commons
              </a>
            ) : (
              "Wikimedia Commons"
            )}{" "}
            ·{" "}
            <button
              type="button"
              onClick={() => pick(null)}
              className="underline"
            >
              Use the default
            </button>
          </>
        ) : (
          credit
        )}
      </figcaption>
      {open && (
        <PicturePicker
          itemId={itemId}
          label="Picture for your review"
          picked={shown}
          onPick={pick}
          onClose={() => setOpen(false)}
        />
      )}
    </figure>
  );
}
