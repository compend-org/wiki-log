// ABOUTME: Fetches a picture of a page, like a review drawn for Instagram, and opens the phone's share sheet with it and a link back.
// ABOUTME: Downloads the picture instead on browsers that can't share files.
"use client";

import { useEffect, useRef, useState } from "react";
import ExternalShareIcon from "@/components/social/ExternalShareIcon";
import { track } from "@/lib/analytics/analytics";
import { SITE_URL } from "@/lib/site";

export default function ShareImageButton({
  imageHref,
  fileName,
  className = "",
}: {
  imageHref: string;
  fileName: string;
  className?: string;
}) {
  const button = useRef<HTMLButtonElement>(null);
  // The picture while it's being fetched, and once it's here
  const fetching = useRef<Promise<File | null> | null>(null);
  const fetched = useRef<File | null>(null);
  const [waiting, setWaiting] = useState(false);

  function fetchPicture(): Promise<File | null> {
    fetching.current ??= fetch(imageHref)
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => blob && new File([blob], fileName, { type: blob.type }))
      .catch(() => null)
      .then((file) => {
        fetched.current = file;
        // A failed fetch is tried again on the next tap
        if (!file) fetching.current = null;
        return file;
      });
    return fetching.current;
  }

  // Drawing the picture takes a few seconds, so it starts as soon as the
  // button is on screen. The button is hidden on wide screens, so they
  // never fetch it.
  useEffect(() => {
    const element = button.current;
    if (!element || fetching.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        fetchPicture();
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  });

  async function onClick() {
    // The link back is to the public site, tagged so visits from shares can
    // be counted, and read before waiting so it matches the tapped page
    const pageLink = new URL(location.pathname, SITE_URL);
    pageLink.searchParams.set("utm_source", "share");
    let file = fetched.current;
    if (!file) {
      setWaiting(true);
      file = await fetchPicture();
      setWaiting(false);
    }
    if (!file) return;

    const shared = { files: [file], url: pageLink.href };
    if (navigator.canShare?.(shared)) {
      try {
        await navigator.share(shared);
        track("share_image_created", { method: "share_sheet" });
      } catch {
        // Cancelled, or the browser only opens the share sheet straight
        // after a tap, which waiting for the picture can outlast. The
        // picture is kept, so the next tap shares it right away.
      }
      return;
    }

    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    track("share_image_created", { method: "download" });
  }

  return (
    <button
      ref={button}
      type="button"
      onClick={onClick}
      disabled={waiting}
      aria-busy={waiting}
      aria-label="Share as image"
      title="Share as image"
      className={`inline-flex h-5 items-center text-muted hover:text-foreground ${className}`}
    >
      {waiting ? (
        <span
          aria-hidden="true"
          className="round h-4 w-4 animate-spin border-2 border-current border-t-transparent"
        />
      ) : (
        <ExternalShareIcon className="h-4 w-4" />
      )}
    </button>
  );
}
