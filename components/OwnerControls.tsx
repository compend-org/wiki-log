"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import EditEntryForm from "@/components/EditEntryForm";
import DeleteButton from "./buttons/DeleteButton";

export default function OwnerControls({
  logId,
  rating,
  review,
  profileHref,
  header,
  body,
}: {
  logId: string;
  rating: number | null;
  review: string;
  // Where to go once the entry is deleted
  profileHref: string;
  // Always shown (the picture, the title, the byline)
  header: ReactNode;
  // Shown until Edit is pressed, then replaced by the form (stars and text)
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
            className="text-accent underline hover:no-underline"
          >
            Edit
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
          initialRating={rating}
          initialReview={review}
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
