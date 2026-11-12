import type { ReactNode } from "react";
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
}) {
  if (ratings.length < MIN_HISTOGRAM_RATINGS) return null;

  const { counts, tallest, average, people } = ratingHistogram(ratings);
  const noun = people === 1 ? unit.one : unit.other;

  const bars = (
    <div
      className={`flex items-end gap-1 ${compact ? "h-12" : "h-20"}`}
      aria-hidden="true"
    >
      {RATING_STEPS.map((step, i) => {
        const picked = highlight !== null && ratingStep(highlight) === step;
        const count = counts[i];
        return (
          <div
            key={step}
            title={`${step} ★: ${count} ${count === 1 ? unit.one : unit.other}`}
            className="flex h-full flex-1 items-end"
          >
            <div
              className={`w-full rounded-sm ${
                picked ? "bg-star" : count > 0 ? "bg-muted/50" : "bg-line/60"
              }`}
              style={{ height: barHeight(count, tallest) }}
            />
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
