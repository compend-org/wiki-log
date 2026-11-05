"use client";

// ABOUTME: Loads the next page of a list once the bottom of it scrolls into view.
// ABOUTME: Takes an href that asks the server for more, or an onLoad callback.

import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef } from "react";

type Props = { href: string } | { onLoad: () => void };

// It loads once per mount, so give it a `key` that changes when the next page
// has arrived. If the bottom is still in view then, it loads again.
export default function LoadMore(props: Props) {
  const router = useRouter();
  const ref = useRef<HTMLParagraphElement>(null);

  const load = useEffectEvent(() => {
    if ("href" in props) router.replace(props.href, { scroll: false });
    else props.onLoad();
  });

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
