// ABOUTME: Counts an item's ratings into half-star bars, shared by the ratings histogram on the page and in its image.
// ABOUTME: Holds how many ratings an item needs before its histogram is shown.
export const RATING_STEPS = Array.from({ length: 10 }, (_, i) => (i + 1) / 2);

// Fewer ratings than this make a histogram too sparse to be worth showing
export const MIN_HISTOGRAM_RATINGS = 10;

// The half-star bar a rating falls in
export function ratingStep(rating: number): number {
  return Math.round(rating * 2) / 2;
}

// How many people gave each half-star from 0.5 to 5, the tallest bar, and
// the average, from one rating per person
export function ratingHistogram(ratings: number[]) {
  const counts = RATING_STEPS.map(
    (step) => ratings.filter((r) => ratingStep(r) === step).length,
  );
  return {
    counts,
    tallest: Math.max(...counts, 1),
    average: ratings.reduce((sum, r) => sum + r, 0) / ratings.length,
    people: ratings.length,
  };
}

// A bar's height as a percentage of the tallest: an empty bar is a thin line
export function barHeight(count: number, tallest: number): string {
  return count > 0 ? `${Math.max(8, (count / tallest) * 100)}%` : "2px";
}

// A half-star rating written as stars, like ★★★½
export function starText(step: number): string {
  const whole = Math.floor(step);
  const half = step % 1 !== 0;
  if (whole === 0) return "½★";
  return "★".repeat(whole) + (half ? "½" : "");
}

// A rating from a URL, if it is one of the half-star steps
export function parseRatingStep(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const n = Number(value);
  return RATING_STEPS.includes(n) ? n : null;
}
