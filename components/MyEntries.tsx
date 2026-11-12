// ABOUTME: The signed-in person's own entries for an item, on the item's page.
// ABOUTME: Each can be edited in place or deleted.
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import EditEntryForm from "@/components/EditEntryForm";
import PostImage from "@/components/PostImage";
import Stars from "@/components/Stars";
import DeleteButton from "./buttons/DeleteButton";
import EditIcon from "./icons/EditIcon";
import ReviewText from "./ReviewText";

export type MyEntry = {
  id: string;
  rating: number;
  review: string;
  // Paths of its image in the post-images bucket
  images: string[];
  // Whether the automatic check has passed its image
  imagesChecked: boolean;
  // When it was logged, as shown: "5m ago", or the date once it's a day old
  loggedAgo: string;
};

export default function MyEntries({
  entries,
  userId,
}: {
  entries: MyEntry[];
  // Whose entries these are: the signed-in person
  userId: string | null;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const router = useRouter();

  if (entries.length === 0 || !userId) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
        Your entries
      </h2>

      {entries.map((e) => (
        <div key={e.id} className="card flex flex-col gap-2 p-3">
          {editing === e.id ? (
            <EditEntryForm
              logId={e.id}
              userId={userId}
              initialRating={e.rating > 0 ? e.rating : null}
              initialReview={e.review}
              initialImages={e.images}
              onCancel={() => setEditing(null)}
              onSaved={() => {
                setEditing(null);
                router.refresh();
              }}
            />
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Stars rating={e.rating} />
                <span className="text-xs text-muted">{e.loggedAgo}</span>
              </div>
              {e.review && (
                <p className="whitespace-pre-wrap text-sm">
                  <ReviewText text={e.review} />
                </p>
              )}
              {e.images.map((path) => (
                <PostImage
                  key={path}
                  path={path}
                  checked={e.imagesChecked}
                  size="small"
                  className="h-20 w-auto max-w-full border border-line object-cover"
                  linkToFull
                />
              ))}
              <div className="flex gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setEditing(e.id)}
                  aria-label="Edit this entry"
                  title="Edit this entry"
                  className="flex text-accent hover:opacity-70 hover:text-foreground"
                >
                  <EditIcon className="h-4 w-4" />
                </button>
                <DeleteButton kind="log" targetId={e.id} />
              </div>
            </>
          )}
        </div>
      ))}
    </section>
  );
}
