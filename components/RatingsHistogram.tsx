import Link from "next/link";
import type { ReactNode } from "react";
import { starText } from "@/lib/format";
import {
  barHeight,
  MIN_HISTOGRAM_RATINGS,
  RATING_STEPS,
  ratingHistogram,
  ratingStep,
} from "@/lib/ratingHistogram";

const PEOPLE = { one: "person", other: "people" };

// How everyone rated one item, or everything one person has rated: a bar for
// each half-star from 0.5 to 5, with the viewer's own rating of an item picked
// out in the star colour.
export default function RatingHistogram({
  ratings,
  highlight,
  action,
  unit = PEOPLE,
  compact = false,
  hrefBase,
}: {
  // One rating per person (or per item, on a profile)
  ratings: number[];
  // The viewer's own rating of this item, if they have one
  highlight: number | null;
  // A button shown beside the average, like sharing the histogram as an image
  action?: ReactNode;
  // What each rating is counted in
  unit?: { one: string; other: string };
  // A small version without the heading, for tight spaces
  compact?: boolean;
  hrefBase?: string;
}) {
  if (ratings.length < MIN_HISTOGRAM_RATINGS) return null;

  const { counts, tallest, average, people } = ratingHistogram(ratings);
  const noun = people === 1 ? unit.one : unit.other;

  const bars = (
    <div
      className={`flex items-end gap-1 ${compact ? "h-12" : "h-20"}`}
      aria-hidden={hrefBase ? undefined : true}
    >
      {RATING_STEPS.map((step, i) => {
        const picked = highlight !== null && ratingStep(highlight) === step;
        const count = counts[i];
        const tip = `${starText(step)} · ${count} ${
          count === 1 ? unit.one : unit.other
        }`;
        // Centred on its bar, except the outer ones, which open inwards so
        // the tooltip stays inside the card
        const place =
          i < 2
            ? "left-0"
            : i >= RATING_STEPS.length - 2
              ? "right-0"
              : "left-1/2 -translate-x-1/2";
        const cell = "group relative flex h-full flex-1 items-end";
        const bar = (
          <>
            <div
              className={`w-full rounded-sm ${
                picked ? "bg-star" : count > 0 ? "bg-muted/50" : "bg-line/60"
              }`}
              style={{ height: barHeight(count, tallest) }}
            />
            <span
              role="tooltip"
              className={`card pointer-events-none absolute bottom-full z-30 mb-1 hidden whitespace-nowrap px-2 py-1 text-xs text-foreground group-hover:block group-focus-visible:block ${place}`}
            >
              {tip}
            </span>
          </>
        );
        return hrefBase && count > 0 ? (
          <Link
            key={step}
            href={`${hrefBase}/${step}`}
            prefetch={false}
            aria-label={tip}
            className={`${cell} transition-opacity hover:opacity-70 hover:no-underline`}
          >
            {bar}
          </Link>
        ) : (
          <div key={step} className={cell}>
            {bar}
          </div>
        );
      })}
    </div>
  );

  const label = `Ratings: ${average.toFixed(1)} average from ${people} ${noun}`;

  if (compact) {
    return (
      <section aria-label={label} className="flex w-44 flex-col gap-1">
        {bars}
        <p className="text-xs text-muted">
          <span className="text-star">★</span> {average.toFixed(1)} · {people}{" "}
          {noun}
        </p>
      </section>
    );
  }

  return (
    <section aria-label={label} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Ratings
        </h2>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted">
            <span className="text-star">★</span> {average.toFixed(1)} average ·{" "}
            {people} {noun}
          </p>
          {action}
        </div>
      </div>
      <div className="card p-4">{bars}</div>
    </section>
  );
}
