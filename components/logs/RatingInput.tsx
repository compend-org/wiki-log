"use client";

import { useRef, useState } from "react";
import Stars from "@/components/logs/Stars";

// Which half-star is under the pointer: 0.5, 1, 1.5 ... 5
function valueAt(el: HTMLElement, clientX: number): number {
  const rect = el.getBoundingClientRect();
  const fraction = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
  return Math.max(1, Math.ceil(fraction * 10)) / 2;
}

// 0 means "no rating"
export default function RatingInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  // The rating before a press began, so a press the browser takes over
  // (a vertical scroll) can be put back
  const before = useRef<number | null>(null);
  const shown = hover ?? value;

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(Math.min(5, value + 0.5));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(Math.max(0.5, value - 0.5));
    } else if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      onChange(0);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 max-sm:justify-center">
      <div
        role="slider"
        tabIndex={0}
        aria-label="Rating (optional)"
        aria-valuemin={0.5}
        aria-valuemax={5}
        aria-valuenow={value > 0 ? value : undefined}
        aria-valuetext={value > 0 ? `${value} out of 5 stars` : "No rating"}
        // On a phone the stars fill the row and sideways drags stay with us,
        // while up and down still scroll the page
        className="inline-flex cursor-pointer touch-pan-y select-none text-3xl max-sm:w-full max-sm:[container-type:inline-size]"
        onPointerDown={(e) => {
          before.current = value;
          e.currentTarget.setPointerCapture(e.pointerId);
          setHover(null);
          onChange(valueAt(e.currentTarget, e.clientX));
        }}
        onPointerMove={(e) => {
          if (before.current !== null) {
            onChange(valueAt(e.currentTarget, e.clientX));
          } else if (e.pointerType === "mouse") {
            setHover(valueAt(e.currentTarget, e.clientX));
          }
        }}
        onPointerUp={() => {
          before.current = null;
        }}
        onPointerCancel={() => {
          if (before.current !== null) onChange(before.current);
          before.current = null;
        }}
        onPointerLeave={() => setHover(null)}
        onKeyDown={handleKeyDown}
      >
        <Stars rating={shown} track className="max-sm:w-full" />
      </div>
      <span className="min-w-8 text-sm text-muted">
        {shown > 0 ? shown : "(optional)"}
      </span>
      {value > 0 && (
        <button
          type="button"
          onClick={() => onChange(0)}
          className="text-xs text-accent underline"
        >
          clear
        </button>
      )}
    </div>
  );
}
