// ABOUTME: A popup grid of the pictures a review or list entry can show: its item's own, then its article's free ones.
// ABOUTME: One tap picks a picture and closes the popup.
"use client";

import { useEffect, useState } from "react";
import { itemPictureChoices } from "@/app/actions";
import ItemImage from "@/components/items/ItemImage";
import Dialog from "@/components/ui/Dialog";
import type { PictureChoice } from "@/lib/pictureChoices";

export default function PicturePicker({
  itemId,
  label,
  picked,
  onPick,
  onClose,
}: {
  itemId: string;
  // Names the popup, such as "Picture for your review"
  label: string;
  // The address of the picture shown now, marked in the grid
  picked: string | null;
  // Null goes back to the item's own picture
  onPick: (choice: PictureChoice | null) => void;
  onClose: () => void;
}) {
  const [choices, setChoices] = useState<PictureChoice[] | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let current = true;
    itemPictureChoices(itemId)
      .then((result) => {
        if (!current) return;
        if ("error" in result) setError(result.error);
        else setChoices(result.choices);
      })
      .catch(() => {
        if (current) setError("Couldn't load the pictures. Try again.");
      });
    return () => {
      current = false;
    };
  }, [itemId]);

  return (
    <Dialog label={label} onClose={onClose}>
      <p className="font-bold">{label}</p>
      {error ? (
        <p className="text-danger">{error}</p>
      ) : choices ? (
        <div className="grid max-h-[55vh] grid-cols-3 gap-2 overflow-y-auto p-0.5">
          {choices.map((c) => (
            <button
              key={c.url}
              type="button"
              aria-pressed={c.url === picked}
              onClick={() => {
                onPick(c);
                onClose();
              }}
              className={`relative rounded ${c.url === picked ? "outline-2 outline-offset-1 outline-accent" : ""}`}
            >
              <ItemImage
                src={c.url}
                alt={c.isDefault ? "The item's own picture" : ""}
                className="aspect-square w-full rounded"
                sourceWidth={250}
              />
              {c.isDefault && (
                <span className="absolute bottom-1 left-1 bg-background/85 px-1 text-xs">
                  Default
                </span>
              )}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-muted">Loading pictures…</p>
      )}
      <div className="flex gap-4">
        {/* Without a picture of its item's own to pick, a chosen picture
            can still be taken away */}
        {picked && choices && !choices.some((c) => c.isDefault) && (
          <button
            type="button"
            onClick={() => {
              onPick(null);
              onClose();
            }}
            className="underline"
          >
            Remove picture
          </button>
        )}
        <button type="button" onClick={onClose} className="underline">
          Cancel
        </button>
      </div>
    </Dialog>
  );
}
