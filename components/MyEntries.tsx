"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteLog, updateLog } from "@/lib/logs";
import RatingInput from "@/components/RatingInput";
import Stars from "@/components/Stars";

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
    const message = await updateLog(id, rating, review);
    setBusy(false);
    if (message) {
      setError(message);
      return;
    }
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
              <textarea
                value={review}
                onChange={(ev) => setReview(ev.target.value)}
                rows={3}
                className="border border-line bg-surface px-3 py-2 text-sm text-foreground"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => save(e.id)}
                  disabled={busy || rating === 0}
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
                <p className="whitespace-pre-wrap text-sm">{e.review}</p>
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
                  className="text-danger underline"
                >
                  Delete
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