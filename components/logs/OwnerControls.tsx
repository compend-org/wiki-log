"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import DeleteButton from "@/components/logs/DeleteButton";
import EditEntryForm from "@/components/logs/EditEntryForm";
import PictureButton from "@/components/logs/PictureButton";
import EditIcon from "@/components/ui/EditIcon";
import type { PictureChoice } from "@/lib/pictureChoices";

export default function OwnerControls({
  logId,
  rating,
  review,
  profileHref,
  picture,
  byline,
  body,
  pictureChoice,
}: {
  logId: string;
  rating: number | null;
  review: string;
  // Where to go once the entry is deleted
  profileHref: string;
  // Always shown, beside the picture (the title, the byline)
  byline: ReactNode;
  // The review's picture, shown until Edit is pressed
  picture: ReactNode;
  // Shown until Edit is pressed, then replaced by the form (stars and text)
  body: ReactNode;
  // While editing, the picture becomes a button that picks another from the
  // item's article. Absent for items without an article.
  pictureChoice?: {
    itemId: string;
    title: string;
    url: string | null;
    nsfw: boolean;
  };
}) {
  const [editing, setEditing] = useState<boolean>(false);
  // The picture picked since Edit was pressed, if any. Null is the item's own.
  const [picked, setPicked] = useState<PictureChoice | null>();
  const router = useRouter();

  function stopEditing() {
    setEditing(false);
    setPicked(undefined);
  }

  return (
    <div className="relative flex flex-col gap-3">
      <div className="absolute right-0 top-0 z-10 flex items-center gap-3 text-xs">
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Edit this entry"
            title="Edit this entry"
            className="flex text-accent hover:opacity-70 hover:text-foreground"
          >
            <EditIcon className="h-4 w-4" />
          </button>
        )}
        <DeleteButton
          kind="log"
          targetId={logId}
          onDeleted={() => {
            router.push(profileHref);
            router.refresh();
          }}
        />
      </div>

      <div className="flex gap-4">
        {editing && pictureChoice ? (
          <PictureButton
            itemId={pictureChoice.itemId}
            title={pictureChoice.title}
            url={
              picked === undefined ? pictureChoice.url : (picked?.url ?? null)
            }
            nsfw={pictureChoice.nsfw}
            onPick={setPicked}
            className="h-28 w-28"
          />
        ) : (
          picture
        )}
        {byline}
      </div>

      {editing ? (
        <EditEntryForm
          logId={logId}
          initialRating={rating}
          initialReview={review}
          pickedPicture={
            picked === undefined
              ? undefined
              : picked && !picked.isDefault
                ? picked.url
                : null
          }
          onCancel={stopEditing}
          onSaved={() => {
            stopEditing();
            router.refresh();
          }}
        />
      ) : (
        body
      )}
    </div>
  );
}
