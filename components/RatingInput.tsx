"use client";

import { useState } from "react";
import Stars from "@/components/Stars";

// Which half-star is under the pointer: 0.5, 1, 1.5 ... 5
function valueAt(el: HTMLElement, clientX: number): number {
  const rect = el.getBoundingClientRect();
  const fraction = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
  return Math.max(1, Math.ceil(fraction * 10)) / 2;
}

export default function RatingInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(Math.min(5, value + 0.5));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(Math.max(0.5, value - 0.5));
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div
        role="slider"
        tabIndex={0}
        aria-label="Rating"
        aria-valuemin={0.5}
        aria-valuemax={5}
        aria-valuenow={value > 0 ? value : undefined}
        aria-valuetext={value > 0 ? `${value} out of 5 stars` : "No rating"}
        className="inline-flex cursor-pointer select-none text-3xl"
        onPointerMove={(e) => {
          if (e.pointerType === "mouse") {
            setHover(valueAt(e.currentTarget, e.clientX));
          }
        }}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => onChange(valueAt(e.currentTarget, e.clientX))}
        onKeyDown={handleKeyDown}
      >
        <Stars rating={shown} />
      </div>
    </div>
  );
}