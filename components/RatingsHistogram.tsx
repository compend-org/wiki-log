import type { ReactNode } from "react";
import {
  barHeight,
  MIN_HISTOGRAM_RATINGS,
  RATING_STEPS,
  ratingHistogram,
  ratingStep,
} from "@/lib/ratingHistogram";

// How everyone rated one item: a bar for each half-star from 0.5 to 5, with
// the viewer's own rating picked out in the star colour.
export default function RatingHistogram({
  ratings,
  highlight,
  action,
}: {
  // One rating per person
  ratings: number[];
  // The viewer's own rating of this item, if they have one
  highlight: number | null;
  // A button shown beside the average, like sharing the histogram as an image
  action?: ReactNode;
}) {
  if (ratings.length < MIN_HISTOGRAM_RATINGS) return null;

  const { counts, tallest, average, people } = ratingHistogram(ratings);

  return (
    <section
      aria-label={`Ratings: ${average.toFixed(1)} average from ${people} ${
        people === 1 ? "person" : "people"
      }`}
      className="card flex flex-col gap-2 p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Ratings
        </h2>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted">
            <span className="text-star">★</span> {average.toFixed(1)} average ·{" "}
            {people} {people === 1 ? "person" : "people"}
          </p>
          {action}
        </div>
      </div>

      <div className="flex h-20 items-end gap-1" aria-hidden="true">
        {RATING_STEPS.map((step, i) => {
          const picked = highlight !== null && ratingStep(highlight) === step;
          const count = counts[i];
          return (
            <div
              key={step}
              title={`${step} ★: ${count} ${count === 1 ? "person" : "people"}`}
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

      <div
        className="flex justify-between text-xs leading-none text-muted"
        aria-hidden="true"
      >
        {/* <span>★</span>
        {highlight !== null && (
          <span>
            <span className="text-star">■</span> Your rating
          </span>
        )}
        <span>★★★★★</span> */}
      </div>
    </section>
  );
}
