"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { logItem } from "@/app/actions";
import PostImageButton from "@/components/PostImageButton";
import PostImagePreview from "@/components/PostImagePreview";
import RatingInput from "@/components/RatingInput";
import { track } from "@/lib/analytics";
import { uploadPostImage } from "@/lib/postImageUpload";
import { createClient } from "@/lib/supabase/client";
import { useImageAttachStatus } from "@/lib/useImageAttachStatus";
import { useLoginHref } from "@/lib/useLoginHref";
import ReviewTextarea from "./ReviewTextArea";

export default function LogForm({
  id,
  viewerId,
  alreadyLogged = false,
}: {
  id: string;
  // The signed-in person, or null when signed out
  viewerId: string | null;
  alreadyLogged?: boolean;
}) {
  const loginHref = useLoginHref();
  const [rating, setRating] = useState<number>(0);
  const [review, setReview] = useState<string>("");
  const [image, setImage] = useState<File | null>(null);
  const imageStatus = useImageAttachStatus(viewerId);
  const [busy, setBusy] = useState<boolean>(false);
  const [done, setDone] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const router = useRouter();

  async function handleSave() {
    if (!viewerId) return;
    setBusy(true);
    setError("");
    setDone(false);
    const images: string[] = [];
    if (image) {
      const uploaded = await uploadPostImage(createClient(), viewerId, image);
      if (uploaded.error !== undefined) {
        setBusy(false);
        setError(uploaded.error);
        return;
      }
      images.push(uploaded.path);
    }
    let result: Awaited<ReturnType<typeof logItem>>;
    try {
      result = await logItem({
        itemId: id,
        rating: rating > 0 ? rating : null,
        review,
        images,
      });
    } catch (error) {
      // The server may have saved the entry before its response was lost.
      // Keep the draft and let the person check before submitting it again.
      setError(
        "We couldn't confirm whether your entry was saved. Check your diary before trying again.",
      );
      Sentry.captureException(error, {
        tags: { action: "logItem", error_source: "log-form" },
        contexts: {
          browser_state: {
            online: navigator.onLine,
            visibility_state: document.visibilityState,
          },
        },
      });
      return;
    } finally {
      setBusy(false);
    }
    if (result.error) {
      setError(result.error);
      return;
    }
    track("item_logged", {
      item_id: id,
      rating: rating > 0 ? rating : null,
      has_review: review.trim() !== "",
      review_length: review.trim().length,
      first_time: !alreadyLogged,
    });
    // Ready for the next entry
    setRating(0);
    setReview("");
    setImage(null);
    setDone(true);
    router.refresh();
  }

  if (!viewerId) {
    return (
      <Link href={loginHref} className="underline">
        Sign in to review this
      </Link>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <RatingInput
        value={rating}
        onChange={(v) => {
          setRating(v);
          setDone(false);
        }}
      />
      <ReviewTextarea
        value={review}
        onChange={(v) => {
          setReview(v);
          setDone(false);
        }}
        placeholder="Add a review (optional)"
        rows={3}
        className="border border-line bg-surface px-4 py-2 text-foreground"
        accessory={
          <PostImageButton
            status={imageStatus}
            onPick={(file) => {
              setImage(file);
              setDone(false);
            }}
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
      <button
        type="button"
        onClick={handleSave}
        disabled={busy}
        className="self-start bg-accent px-4 py-2 text-background disabled:opacity-40"
      >
        {busy ? "Saving…" : alreadyLogged ? "Log it again" : "Log it"}
      </button>
      {done && <p className="text-sm text-accent">Entry added.</p>}
      {error && <p className="text-danger">{error}</p>}
    </div>
  );
}
