// ABOUTME: The form for changing your own entry's rating, review text and image.
// ABOUTME: A new image is uploaded on save, and the server deletes the one it replaces.
"use client";

import { useState } from "react";
import { updateReview } from "@/app/actions";
import PostImageButton from "@/components/PostImageButton";
import PostImagePreview from "@/components/PostImagePreview";
import RatingInput from "@/components/RatingInput";
import { track } from "@/lib/analytics";
import { uploadPostImage } from "@/lib/postImageUpload";
import { createClient } from "@/lib/supabase/client";
import { useImageAttachStatus } from "@/lib/useImageAttachStatus";
import ReviewTextarea from "./ReviewTextArea";

const MAX = 5000;

export default function EditEntryForm({
  logId,
  userId,
  initialRating,
  initialReview,
  initialImages,
  onSaved,
  onCancel,
}: {
  logId: string;
  // The entry's author, who is the one editing it
  userId: string;
  initialRating: number | null;
  initialReview: string;
  // Paths of the image the entry has, in the post-images bucket
  initialImages: string[];
  onSaved: (rating: number | null, review: string, images: string[]) => void;
  onCancel: () => void;
}) {
  const [rating, setRating] = useState<number>(initialRating ?? 0);
  const [review, setReview] = useState<string>(initialReview);
  // A file just picked, the path of the image already there, or none
  const [image, setImage] = useState<File | string | null>(
    initialImages[0] ?? null,
  );
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const imageStatus = useImageAttachStatus(userId);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const cleanReview = review.replace(/\r\n/g, "\n").trim();
    const newRating = rating > 0 ? rating : null;

    setBusy(true);
    setError("");
    let images: string[] = typeof image === "string" ? [image] : [];
    if (image instanceof File) {
      const uploaded = await uploadPostImage(createClient(), userId, image);
      if (uploaded.error !== undefined) {
        setBusy(false);
        setError(uploaded.error);
        return;
      }
      images = [uploaded.path];
    }
    const result = await updateReview(logId, {
      rating: newRating,
      review: cleanReview,
      images,
    });
    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    track("log_edited", {
      has_rating: newRating !== null,
      has_review: cleanReview !== "",
    });
    onSaved(newRating, cleanReview, images);
  }

  return (
    <form onSubmit={handleSave} className="flex w-full flex-col gap-2">
      <RatingInput value={rating} onChange={setRating} />
      <ReviewTextarea
        value={review}
        onChange={setReview}
        maxLength={MAX}
        accessory={
          <PostImageButton
            status={imageStatus}
            onPick={setImage}
            onError={setError}
            disabled={busy}
          />
        }
      />
      <PostImagePreview
        image={image}
        onRemove={() => setImage(null)}
        disabled={busy}
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
