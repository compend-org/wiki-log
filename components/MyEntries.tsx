"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import RatingInput from "@/components/RatingInput";
import Stars from "@/components/Stars";
import { track } from "@/lib/analytics";
import { deleteLog, updateLog } from "@/lib/logs";
import DeleteIcon from "./icons/DeleteIcon";
import ReviewText from "./ReviewText";
import ReviewTextarea from "./ReviewTextArea";

export type MyEntry = {
  id: string;
  rating: number;
  review: string;
  loggedAt: string;
};

export default function MyEntries({ entries }: { entries: MyEntry[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [review, setReview] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const router = useRouter();

  if (entries.length === 0) return null;

  function startEdit(e: MyEntry) {
    setEditing(e.id);
    setRating(e.rating);
    setReview(e.review);
    setError("");
  }

  async function save(id: string) {
    setBusy(true);
    setError("");
    const message = await updateLog(id, rating > 0 ? rating : null, review);
    setBusy(false);
    if (message) {
      setError(message);
      return;
    }
    track("log_edited", {
      has_rating: rating > 0,
      has_review: review.trim() !== "",
    });
    setEditing(null);
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this entry, with its likes and comments?")) {
      return;
    }
    setBusy(true);
    setError("");
    const message = await deleteLog(id);
    setBusy(false);
    if (message) {
      setError(message);
      return;
    }
    track("log_deleted");
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
        Your entries
      </h2>

      {entries.map((e) => (
        <div key={e.id} className="card flex flex-col gap-2 p-3">
          {editing === e.id ? (
            <>
              <RatingInput value={rating} onChange={setRating} />
              <ReviewTextarea value={review} onChange={setReview} />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => save(e.id)}
                  disabled={busy}
                  className="bg-accent px-3 py-1.5 text-sm text-background disabled:opacity-40"
                >
                  {busy ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="border border-line px-3 py-1.5 text-sm"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Stars rating={e.rating} />
                <span className="text-xs text-muted">
                  {e.loggedAt.slice(0, 10)}
                </span>
              </div>
              {e.review && (
                <p className="whitespace-pre-wrap text-sm">
                  <ReviewText text={e.review} />
                </p>
              )}
              <div className="flex gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => startEdit(e)}
                  className="text-accent underline"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => remove(e.id)}
                  disabled={busy}
                  aria-label="Delete this entry"
                  title="Delete this entry"
                  className="flex items-center text-danger hover:opacity-70 disabled:opacity-40"
                >
                  <DeleteIcon className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>
      ))}

      {error && <p className="text-sm text-danger">{error}</p>}
    </section>
  );
}
