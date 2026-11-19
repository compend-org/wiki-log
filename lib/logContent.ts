// ABOUTME: The rule that a log needs a rating or some review text.
// ABOUTME: Checked in the forms and on the server; the database enforces it too.

export const NEEDS_CONTENT = "Add a rating or a review.";

// A rating of 0 or null means none; a review of only spaces is empty
export function hasLogContent(
  rating: number | null | undefined,
  review: string,
): boolean {
  return (rating ?? 0) > 0 || review.trim() !== "";
}
