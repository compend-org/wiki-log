"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import ItemImage from "@/components/ItemImage";

type Thumb = { title: string; image_url: string | null };

// useLayoutEffect only produces a warning when rendered on the server
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function ListPreview({
  thumbs,
  total,
}: {
  thumbs: Thumb[];
  total: number;
}) {
  const row = useRef<HTMLDivElement>(null);
  // How many tiles fit on one line, or null until measured
  const [fit, setFit] = useState<number | null>(null);

  useIsoLayoutEffect(() => {
    const el = row.current;
    if (!el) return;

    function measure() {
      const container = row.current;
      const first = container?.firstElementChild as HTMLElement | null;
      if (!container || !first) return;

      const tile = first.getBoundingClientRect().width;
      const width = container.clientWidth;
      // Copies hidden with display: none measure as zero, so leave them alone
      if (tile === 0 || width === 0) return;

      const gap = parseFloat(getComputedStyle(container).columnGap) || 0;
      setFit(
        Math.max(1, Math.floor((width + gap) / (tile + gap) + 0.01))
      );
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Show every item if they all fit. Otherwise give up the last slot for "+N".
  const room = fit ?? thumbs.length;
  let visible = thumbs.slice(0, room);
  let remaining = total - visible.length;
  if (remaining > 0) {
    visible = thumbs.slice(0, Math.max(0, room - 1));
    remaining = total - visible.length;
  }

  return (
    <div ref={row} className="flex h-14 flex-wrap gap-1 overflow-hidden">
      {visible.map((p, i) => (
        <ItemImage
          key={i}
          src={p.image_url}
          alt={p.title}
          className="h-14 w-14 shrink-0 rounded"
        />
      ))}
      {remaining > 0 && (
        <div
          role="img"
          aria-label={`${remaining} more ${remaining === 1 ? "item" : "items"}`}
          className="flex h-14 w-14 shrink-0 items-center justify-center border border-line bg-surface text-sm font-semibold text-muted"
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}