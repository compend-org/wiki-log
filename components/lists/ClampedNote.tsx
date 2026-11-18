// ABOUTME: A list item's note, cut to four lines with "Read more" when it's longer than that.
// ABOUTME: The link only shows when the note is actually cut at the current width.
"use client";

import { useLayoutEffect, useRef, useState } from "react";

export default function ClampedNote({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [cut, setCut] = useState(false);

  useLayoutEffect(() => {
    const note = ref.current;
    if (!note || expanded) return;
    const measure = () => setCut(note.scrollHeight > note.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(note);
    return () => observer.disconnect();
  }, [expanded]);

  return (
    <>
      <p
        ref={ref}
        className={`whitespace-pre-wrap break-words text-[16px] leading-relaxed sm:text-base ${
          expanded ? "" : "line-clamp-4"
        }`}
      >
        {text}
      </p>
      {(cut || expanded) && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
          className="-mt-1 self-start pb-3 text-sm text-accent underline"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </>
  );
}
