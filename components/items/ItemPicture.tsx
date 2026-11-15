// ABOUTME: An item's picture that asks the server for a replacement when it fails to load.
// ABOUTME: Wikimedia renames and deletes files, which breaks the image addresses we store.
"use client";

import { type MouseEvent, useEffect, useRef, useState } from "react";
import { reportBrokenImage } from "@/app/actions";
import { thumbUrl } from "@/lib/format";
import { currentSfwMode } from "@/lib/sfw";

export default function ItemPicture({
  src,
  fullSize = false,
  sourceWidth,
  alt,
  nsfw = false,
  tapToShow = true,
  className,
  ...rest
}: {
  // The stored image address
  src: string;
  // Show the stored image as it is, rather than a smaller version
  fullSize?: boolean;
  // The widest image to fetch, in pixels, for boxes that only show it small
  sourceWidth?: number;
  alt: string;
  // Adult content, blurred and labelled in SFW mode until tapped
  nsfw?: boolean;
  // Whether a tap on a blurred image shows it. Otherwise the tap goes to
  // whatever the image sits in.
  tapToShow?: boolean;
  className?: string;
  loading?: "lazy" | "eager";
  draggable?: boolean;
}) {
  const [replaced, setReplaced] = useState<{ from: string; to: string }>();
  const current = replaced?.from === src ? replaced.to : src;
  const reported = useRef(new Set<string>());
  const img = useRef<HTMLImageElement>(null);
  // The image that was tapped to show it; a different image starts hidden again
  const [revealedSrc, setRevealedSrc] = useState<string>();
  const revealed = revealedSrc === src;

  function replace() {
    // Each address is reported once, so a replacement that also fails can't loop
    if (reported.current.has(current)) return;
    reported.current.add(current);
    reportBrokenImage(current)
      .then((url) => {
        if (url) setReplaced({ from: src, to: url });
      })
      .catch(() => {});
  }

  // An image can fail before the page is interactive, when onError isn't
  // listening yet
  // biome-ignore lint/correctness/useExhaustiveDependencies: checks once per address
  useEffect(() => {
    const el = img.current;
    if (el?.complete && el.naturalWidth === 0) replace();
  }, [current]);

  const picture = (
    // biome-ignore lint/performance/noImgElement: a plain img is intended
    <img
      ref={img}
      src={fullSize ? current : thumbUrl(current, sourceWidth)}
      alt={alt}
      onError={replace}
      className={nsfw ? "block h-full w-full object-cover" : className}
      {...rest}
    />
  );
  if (!nsfw) return picture;

  // The first tap on a blurred image shows it, instead of following a link
  // the image sits in
  function reveal(e: MouseEvent) {
    if (revealed || currentSfwMode() === "off") return;
    e.preventDefault();
    e.stopPropagation();
    setRevealedSrc(src);
  }

  return (
    <span
      data-nsfw
      data-revealed={revealed || undefined}
      onClickCapture={tapToShow ? reveal : undefined}
      className={`relative grid overflow-hidden ${className ?? ""}`}
    >
      {picture}
      <span className="nsfw-label absolute inset-0 flex-col items-center justify-center bg-background/30 text-center text-xs font-bold text-foreground">
        NSFW
        {tapToShow && <span className="font-normal">Tap to show</span>}
      </span>
    </span>
  );
}
