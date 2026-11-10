// ABOUTME: Fetches a picture of a page, like a review drawn for Instagram, and opens the phone's share sheet with it.
// ABOUTME: Downloads the picture instead on browsers that can't share files.
"use client";

import { useRef } from "react";
import ExternalShareIcon from "@/components/icons/ExternalShareIcon";
import { track } from "@/lib/analytics";

export default function ShareImageButton({
  imageHref,
  fileName,
  className = "",
}: {
  imageHref: string;
  fileName: string;
  className?: string;
}) {
  // A picture that's fetched but still waiting for a tap to share it
  const ready = useRef<File | null>(null);
  const busy = useRef<boolean>(false);

  async function share(file: File) {
    try {
      await navigator.share({ files: [file] });
      ready.current = null;
      track("share_image_created", { method: "share_sheet" });
    } catch (error) {
      // Some browsers only open the share sheet straight after a tap, which
      // fetching the picture can outlast. Then the next tap shares it.
      const name = error instanceof DOMException ? error.name : "";
      ready.current = name === "NotAllowedError" ? file : null;
    }
  }

  async function onClick() {
    if (ready.current) {
      await share(ready.current);
      return;
    }
    if (busy.current) return;

    busy.current = true;
    const res = await fetch(imageHref).catch(() => null);
    const blob = res?.ok ? await res.blob() : null;
    busy.current = false;
    if (!blob) return;

    const file = new File([blob], fileName, { type: blob.type });
    if (navigator.canShare?.({ files: [file] })) {
      await share(file);
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    track("share_image_created", { method: "download" });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Share as image"
      title="Share as image"
      className={`inline-flex h-5 items-center text-muted hover:text-foreground ${className}`}
    >
      <ExternalShareIcon className="h-4 w-4" />
    </button>
  );
}
