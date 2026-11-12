// ABOUTME: A small preview of the image or GIF attached to a comment being written, with a button to drop it.
// ABOUTME: The file stays in the browser until the comment is posted.
"use client";

import { useEffect, useMemo } from "react";

export default function CommentImagePreview({
  file,
  onRemove,
  disabled = false,
}: {
  file: File | null;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

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
