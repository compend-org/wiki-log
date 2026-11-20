// ABOUTME: The rule for what counts as a rating: half stars from ½ to 5, or none.
// ABOUTME: Checked by the server before a log entry or its draft is stored.

// Null is no rating
export function isValidRating(rating: unknown): rating is number | null {
  return (
    rating === null ||
    (typeof rating === "number" &&
      Number.isFinite(rating) &&
      rating >= 0.5 &&
      rating <= 5 &&
      (rating * 2) % 1 === 0)
  );
}
