// ABOUTME: A tap area over a list item's note icon, for phones, which can't hover to see the note.
// ABOUTME: Tapping it opens the whole note in a popup, with a way on to the item.
"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import ItemImage from "@/components/items/ItemImage";
import Dialog from "@/components/ui/Dialog";

export default function ListNoteButton({
  itemId,
  title,
  note,
  imageUrl,
  nsfw,
  rank,
  owner,
}: {
  itemId: string;
  title: string;
  note: string;
  imageUrl: string | null;
  nsfw: boolean;
  // Only set on ranked lists
  rank: number | null;
  owner: string | null;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Only on devices that can't hover; the rest see the note on hover */}
      <button
        type="button"
        aria-label={`Read the note on ${title}`}
        onClick={() => setOpen(true)}
        className="absolute -bottom-1.5 -right-1 hidden h-7 w-8 [@media(hover:none)]:block"
      />

      {open && (
        <Dialog label={`Note on ${title}`} onClose={() => setOpen(false)}>
          <div className="flex items-center gap-3">
            <ItemImage
              src={imageUrl}
              nsfw={nsfw}
              alt={title}
              sourceWidth={120}
              className="size-14 shrink-0 rounded-lg"
            />
            <div className="flex min-w-0 flex-col">
              <span className="text-muted">
                {rank !== null && (
                  <>
                    <b className="text-accent">#{rank}</b> ·{" "}
                  </>
                )}
                {owner ? `${owner}'s note on` : "A note on"}
              </span>
              <Link
                href={`/item/${itemId}`}
                className="text-lg font-semibold text-accent [overflow-wrap:anywhere]"
              >
                {title}
              </Link>
            </div>
          </div>

          <p className="whitespace-pre-wrap break-words text-base">{note}</p>

          <div className="flex gap-2">
            <Link
              href={`/item/${itemId}`}
              className="flex-1 truncate rounded-lg bg-accent px-3 py-1.5 text-center text-background"
            >
              {t("lists.notes.openItem", { title })}
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-lg border border-line px-3 py-1.5"
            >
              {t("common.close")}
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
