// ABOUTME: A small preview of the image or GIF attached to a review or comment being written, with a button to drop it.
// ABOUTME: A newly picked file stays in the browser until the post is saved.
"use client";

import { useEffect, useMemo } from "react";
import { postImageUrl } from "@/lib/postImages";

export default function PostImagePreview({
  image,
  onRemove,
  disabled = false,
}: {
  // A file just picked, or the path of the image the post already has
  image: File | string | null;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const fileUrl = useMemo(
    () => (image instanceof File ? URL.createObjectURL(image) : null),
    [image],
  );
  useEffect(
    () => () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    },
    [fileUrl],
  );

  const url = typeof image === "string" ? postImageUrl(image) : fileUrl;
  if (!url) return null;
  return (
    <div className="relative self-start">
      {/* biome-ignore lint/performance/noImgElement: a local preview */}
      <img
        src={url}
        alt=""
        className="h-16 w-16 rounded-lg border border-line object-cover"
      />
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label="Remove image"
        className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-background text-sm leading-none"
      >
        ×
      </button>
    </div>
  );
}
