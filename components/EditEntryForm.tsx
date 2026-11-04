"use client";

import { useState } from "react";
import RatingInput from "@/components/RatingInput";
import { createClient } from "@/lib/supabase/client";

const MAX = 5000;

export default function EditEntryForm({
  logId,
  initialRating,
  initialReview,
  onSaved,
  onCancel,
}: {
  logId: string;
  initialRating: number | null;
  initialReview: string;
  onSaved: (rating: number | null, review: string) => void;
  onCancel: () => void;
}) {
  const [rating, setRating] = useState<number>(initialRating ?? 0);
  const [review, setReview] = useState<string>(initialReview);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const cleanReview = review.replace(/\r\n/g, "\n").trim();
    const newRating = rating > 0 ? rating : null;

    setBusy(true);
    setError("");
    const { data, error } = await createClient()
      .from("logs")
      .update({ rating: newRating, review: cleanReview })
      .eq("id", logId)
      .select("id");
    setBusy(false);

    if (error) {
      setError(error.message);
      return;
    }
    // Row-level security refuses silently when the entry isn't yours
    if (!data || data.length === 0) {
      setError("Couldn't save that change.");
      return;
    }
    onSaved(newRating, cleanReview);
  }

  return (
    <form onSubmit={handleSave} className="flex w-full flex-col gap-2">
      <RatingInput value={rating} onChange={setRating} />
      <textarea
        value={review}
        onChange={(e) => setReview(e.target.value)}
        maxLength={MAX}
        rows={4}
        placeholder="Write a review (optional)"
        className="border border-line bg-surface px-3 py-2 text-sm text-foreground"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="bg-accent px-4 py-1.5 text-sm text-background disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="text-sm underline"
        >
          Cancel
        </button>
        <span className="text-xs text-muted">
          {review.length}/{MAX}
        </span>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </form>
  );
}
