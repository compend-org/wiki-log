// ABOUTME: The big picture at the top of an item's page, with its credit underneath.
// ABOUTME: Signed-in visitors can pick another picture from the article for the review they're writing.
"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import ItemPicture from "@/components/items/ItemPicture";
import { useReviewDraft } from "@/components/items/ReviewDraftContext";
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
  const t = useTranslations();
  const { picked, pick } = useReviewDraft();
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
            aria-label={t("item.heroPicture.choose")}
            title={t("item.heroPicture.choose")}
            className="absolute bottom-2 right-2 flex items-center gap-1 border border-line bg-background/90 px-2 py-1 text-xs text-foreground"
          >
            <EditIcon className="h-3 w-3" />
            {t("common.change")}
          </button>
        )}
      </div>
      <figcaption className="text-center text-xs text-muted">
        {chosen ? (
          <>
            {chosen.filePage
              ? t.rich("item.heroPicture.imageCredit", {
                  link: (c) => (
                    <a
                      href={chosen.filePage ?? undefined}
                      className="underline"
                    >
                      {c}
                    </a>
                  ),
                })
              : t("item.heroPicture.imageCreditPlain")}{" "}
            ·{" "}
            <button
              type="button"
              onClick={() => pick(null)}
              className="underline"
            >
              {t("item.heroPicture.useDefault")}
            </button>
          </>
        ) : (
          credit
        )}
      </figcaption>
      {open && (
        <PicturePicker
          itemId={itemId}
          label={t("item.heroPicture.forReview")}
          picked={shown}
          onPick={pick}
          onClose={() => setOpen(false)}
        />
      )}
    </figure>
  );
}
