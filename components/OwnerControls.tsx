"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import EditEntryForm from "@/components/EditEntryForm";
import DeleteButton from "./buttons/DeleteButton";
import EditIcon from "./icons/EditIcon";

export default function OwnerControls({
  logId,
  userId,
  rating,
  review,
  images,
  profileHref,
  header,
  body,
}: {
  logId: string;
  // The entry's author, who is the one viewing it
  userId: string;
  rating: number | null;
  review: string;
  // Paths of the entry's image in the post-images bucket
  images: string[];
  // Where to go once the entry is deleted
  profileHref: string;
  // Always shown (the picture, the title, the byline)
  header: ReactNode;
  // Shown until Edit is pressed, then replaced by the form (stars, text and image)
  body: ReactNode;
}) {
  const [editing, setEditing] = useState<boolean>(false);
  const router = useRouter();

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

      {header}

      {editing ? (
        <EditEntryForm
          logId={logId}
          userId={userId}
          initialRating={rating}
          initialReview={review}
          initialImages={images}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      ) : (
        body
      )}
    </div>
  );
}
