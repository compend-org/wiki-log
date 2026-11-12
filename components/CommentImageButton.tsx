// ABOUTME: The picture icon inside the comment box that picks an image or GIF to attach.
// ABOUTME: Accounts under 3 days old get a tooltip saying why instead; blocked accounts don't see it.
"use client";

import { useId, useRef, useState } from "react";
import ImageIcon from "@/components/icons/ImageIcon";
import {
  commentImageProblem,
  type ImageAttachStatus,
} from "@/lib/commentImages";

export default function CommentImageButton({
  status,
  onPick,
  onError,
  disabled = false,
}: {
  // Whether the viewer's account may attach images; null while finding out
  status: ImageAttachStatus | null;
  // Called with the chosen file, which replaces any picked before
  onPick: (file: File) => void;
  // Called with why the chosen file can't be attached
  onError: (message: string) => void;
  disabled?: boolean;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const tipId = useId();
  // Tapping shows the tooltip on touch screens, which can't hover
  const [tipShown, setTipShown] = useState<boolean>(false);

  if (status === null || status === "blocked") return null;
  const tooNew = status === "new_account";

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // so choosing the same file again still triggers this
    if (!file) return;
    const problem = commentImageProblem(file);
    if (problem) onError(problem);
    else onPick(file);
  }

  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label="Add image or GIF"
        aria-describedby={tooNew ? tipId : undefined}
        title={tooNew ? undefined : "Add image or GIF"}
        disabled={disabled}
        onClick={() =>
          tooNew ? setTipShown((shown) => !shown) : fileInput.current?.click()
        }
        onBlur={() => setTipShown(false)}
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:text-foreground disabled:opacity-40"
      >
        <ImageIcon className="h-5 w-5" />
      </button>
      {tooNew && (
        <span
          id={tipId}
          role="tooltip"
          className={`absolute bottom-full left-0 z-10 mb-1 w-56 rounded-md border border-line bg-background px-2 py-1 text-xs text-foreground ${
            tipShown ? "block" : "hidden group-hover:block"
          }`}
        >
          You can add images and GIFs once your account is 3 days old.
        </span>
      )}
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
    </span>
  );
}
