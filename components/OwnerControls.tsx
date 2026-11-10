"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import DeleteIcon from "@/components/DeleteIcon";
import EditEntryForm from "@/components/EditEntryForm";
import { track } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";

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
  const [error, setError] = useState<string>("");
  const router = useRouter();

  async function handleDelete() {
    if (
      !window.confirm(
        "Delete this entry? Its likes and comments are deleted with it, and this can't be undone.",
      )
    ) {
      return;
    }
    const { data, error } = await createClient()
      .from("logs")
      .delete()
      .eq("id", logId)
      .select("id");
    if (error) {
      setError(error.message);
      return;
    }
    // Row-level security refuses silently when the entry isn't yours
    if (!data || data.length === 0) {
      setError("Couldn't delete that entry.");
      return;
    }
    track("log_deleted");
    router.push(profileHref);
    router.refresh();
  }

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
        <button
          type="button"
          onClick={handleDelete}
          aria-label="Delete this entry"
          title="Delete this entry"
          className="flex text-danger hover:opacity-70"
        >
          <DeleteIcon className="h-4 w-4" />
        </button>
      </div>

      {header}

      {error && <p className="text-sm text-danger">{error}</p>}

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
