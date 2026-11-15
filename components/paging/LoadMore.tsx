"use client";

// ABOUTME: Loads the next page of a list once the bottom of it scrolls into view.
// ABOUTME: Calls onLoad to fetch it; the caller appends what comes back.

import { useEffect, useEffectEvent, useRef } from "react";

// It loads once per mount, so give it a `key` that changes when the next page
// has arrived. If the bottom is still in view then, it loads again.
export default function LoadMore({ onLoad }: { onLoad: () => void }) {
  const ref = useRef<HTMLParagraphElement>(null);

  const load = useEffectEvent(() => onLoad());

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Starts a little before the bottom is reached, so scrolling rarely stops
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          load();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <p ref={ref} className="self-center py-2 text-sm text-muted">
      Loading more…
    </p>
  );
}
